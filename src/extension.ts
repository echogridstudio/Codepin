import { PinProvider, CodePin, CodePinFolder } from './pinProvider';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {loadTags, saveTags, CodepinTag, TagQuickPickItem} from './tagManager'

export function activate(context: vscode.ExtensionContext) {

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    let lastSelection: "Team" | "Local" = "Team";
    if (!workspaceFolder) {
        vscode.window.showWarningMessage("No workspace open.");
        return;
    }
    let lastDeleted: { pins: CodePin[], folders: CodePinFolder[], filePath?: string } | null = null;
    const pinProvider = new PinProvider(workspaceFolder, context);

    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('codepin.showFullPath') || e.affectsConfiguration('codepin.openPinOnClick') || e.affectsConfiguration('codepin.showTagColors')) {
            pinProvider.refresh();
        }
    });

    const treeView = vscode.window.createTreeView('codepinView', {
        treeDataProvider: pinProvider,
        canSelectMany: true,
        dragAndDropController: pinProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    pinProvider.refresh();

    context.subscriptions.push(
    vscode.commands.registerCommand('codepin.search', async () => {
        const allPins = [...pinProvider.teamPins, ...pinProvider.localPins];
        const allFolders = [...pinProvider.teamFolders, ...pinProvider.localFolders];

        searchPinsAndFoldersQuickInput(allPins, allFolders, async (pin, folder) => {
        if (pin) {
            const pinItem = pinProvider.getPinItemForPin(pin); // You might need to implement this!
            try {
                await treeView.reveal(pinItem, { expand: true, select: true, focus: true });
            } catch (err) {
                vscode.window.showWarningMessage('Could not reveal pin in tree');
            }
            // Optionally: open file/position too (if you want both behaviors)
            vscode.commands.executeCommand('codepin.openPin', { pin });
        } else if (folder) {
            const pinItem = pinProvider.getPinItemForFolder(folder);
            try {
                await treeView.reveal(pinItem, { expand: true, select: true, focus: true });
            } catch (err) {
                vscode.window.showWarningMessage('Could not reveal folder in tree');
            }
        }
});

    })
);



    //asignTag code
    context.subscriptions.push(
        vscode.commands.registerCommand('codepin.assignTag', async (item) => {
            if (!workspaceFolder) {
            vscode.window.showWarningMessage("No workspace open.");
            return;
            }

            // Load tags
            const tags = loadTags(workspaceFolder);

            if (!tags.length) {
            vscode.window.showInformationMessage("No tags defined yet! Use the Tag Manager in the titlebar to add some.");
            return;
            }

            // Get currently assigned tag ids
              let currentTags: string[] = [];
                if (item.isFolder && item.folder && Array.isArray(item.folder.tags)) {
                currentTags = item.folder.tags;
                } else if (item.pin && Array.isArray(item.pin.tags)) {
                currentTags = item.pin.tags;
                }

            // Build QuickPick items, showing all tags (checked if already assigned)
            const pickItems = tags.map(tag => ({
            label: `${colorToEmoji(tag.color)} ${tag.name}`,
            picked: currentTags.includes(tag.id),
            id: tag.id
            }));

            // Multi-select: allow user to add/remove tags in one go
            const picked = await vscode.window.showQuickPick(pickItems, {
            placeHolder: 'Assign or remove tags (multi-select)',
            canPickMany: true
            });

            if (!picked) return; // Cancelled

            // Build new array of selected tag ids
            const selectedTagIds = picked.map(p => p.id);

            // Update the pin or folder with the new tag set
            const isTeam = item.pin?.type === 'team' || item.folder?.type === 'team';
            const pinFilePath = isTeam
            ? path.join(workspaceFolder, ".codepin.team.json")
            : path.join(workspaceFolder, ".codepin.local.json");

            if (!fs.existsSync(pinFilePath)) return;
            let pins: CodePin[] = [];
            let folders: CodePinFolder[] = [];
            try {
            const raw = fs.readFileSync(pinFilePath, "utf8");
            const parsed = JSON.parse(raw);
            pins = parsed.pins || [];
            folders = parsed.folders || [];
            } catch { return; }

            let changed = false;
            if (item.isFolder && item.folder) {
            folders = folders.map(f =>
                f.id === item.folder.id
                ? { ...f, tags: selectedTagIds }
                : f
            );
            changed = true;
            } else if (item.pin) {
            pins = pins.map(p =>
                p.id === item.pin.id
                ? { ...p, tags: selectedTagIds }
                : p
            );
            changed = true;
            }

            if (changed) {
            fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
            pinProvider.refresh?.();
            //vscode.window.showInformationMessage(
                //selectedTagIds.length
                //? `Tags updated!`
                //: `All tags removed.`
            //);
            }
        })
        );


    // tagManager code
    context.subscriptions.push(
    vscode.commands.registerCommand('codepin.tagManager', async () => {
        if (!workspaceFolder) {
        vscode.window.showWarningMessage("No workspace open.");
        return;
        }

        // Load all tags
        const tags = loadTags(workspaceFolder);

        // Build QuickPick items (Add Tag first)
        const items: TagQuickPickItem[] = [
        { label: '$(add) Add Tag', alwaysShow: true, id: '' }
        ];

        // Add all tags as selectable items
        if (tags.length > 0) {
        items.push(...tags.map(tag => ({
            label: `${colorToEmoji(tag.color)} ${tag.name}`,
            description: '', // optional
            detail: '',      // optional
            id: tag.id
        })));
        }

        // Show QuickPick
        const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Tag Manager: Add, rename, or delete tags'
        });
        if (!picked) return;

        // ----- Add Tag -----
        if (picked.label === '$(add) Add Tag') {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a tag name',
            validateInput: (input) => {
            if (!input.trim()) return 'Tag name cannot be empty';
            if (tags.some(tag => tag.name.toLowerCase() === input.trim().toLowerCase())) {
                return 'Tag already exists';
            }
            return null;
            }
        });
        if (!name) return; // User cancelled

        const color = await vscode.window.showQuickPick(
            [
            { label: '🟥 Red', value: 'red' },
            { label: '🟨 Yellow', value: 'yellow' },
            { label: '🟦 Blue', value: 'blue' },
            { label: '🟩 Green', value: 'green' },
            { label: '🟪 Purple', value: 'purple' },
            { label: '🟧 Orange', value: 'orange' },
            { label: '🟫 Brown', value: 'brown' },
            { label: '⬛ Black', value: 'black' },
            { label: '⬜ White', value: 'white' }
            ],
            { placeHolder: 'Choose a tag color' }
        );
        if (!color) return; // User cancelled

        const newTag: CodepinTag = {
            id: uuidv4(),
            name: name.trim(),
            color: color.value
        };
        const newTags = [...tags, newTag];
        saveTags(workspaceFolder, newTags);
        pinProvider.refresh();
        vscode.window.showInformationMessage(`Tag "${name.trim()}" added!`);
        await vscode.commands.executeCommand('codepin.tagManager');
        return;
        }

        // ----- Edit Tag -----
        // Now we can type-safely use picked.id!
        const tagToEdit = tags.find(tag => tag.id === picked.id);
        if (!tagToEdit) return;

        const editPicked = await vscode.window.showQuickPick([
        { label: '$(edit) Rename Tag' },
        { label: '$(symbol-color) Change Color' },
        { label: '$(trash) Delete Tag' },
        { label: 'Cancel' }
        ], { placeHolder: `Edit tag: ${tagToEdit.name}` });

        if (!editPicked || editPicked.label === 'Cancel') return;

        if (editPicked.label === '$(edit) Rename Tag') {
        const newName = await vscode.window.showInputBox({
            prompt: `Rename tag "${tagToEdit.name}"`,
            value: tagToEdit.name,
            validateInput: (input) => {
            if (!input.trim()) return 'Tag name cannot be empty';
            if (tags.some(tag => tag.name.toLowerCase() === input.trim().toLowerCase() && tag.id !== tagToEdit.id)) {
                return 'Another tag already has this name';
            }
            return null;
            }
        });
        if (!newName || newName === tagToEdit.name) return;
        tagToEdit.name = newName.trim();
        saveTags(workspaceFolder, tags);
        pinProvider.refresh();
        vscode.window.showInformationMessage(`Tag renamed to "${tagToEdit.name}".`);
        await vscode.commands.executeCommand('codepin.tagManager');
        return;
        }

        if (editPicked.label === '$(symbol-color) Change Color') {
        const newColor = await vscode.window.showQuickPick([
            { label: '🟥 Red', value: 'red' },
            { label: '🟨 Yellow', value: 'yellow' },
            { label: '🟦 Blue', value: 'blue' },
            { label: '🟩 Green', value: 'green' },
            { label: '🟪 Purple', value: 'purple' },
            { label: '🟧 Orange', value: 'orange' },
            { label: '🟫 Brown', value: 'brown' },
            { label: '⬛ Black', value: 'black' },
            { label: '⬜ White', value: 'white' }
        ], { placeHolder: 'Choose a new tag color' });
        if (!newColor || newColor.value === tagToEdit.color) return;
        tagToEdit.color = newColor.value;
        saveTags(workspaceFolder, tags);
        pinProvider.refresh();
        //vscode.window.showInformationMessage(`Tag color changed!`);
        await vscode.commands.executeCommand('codepin.tagManager');
        return;
        }

        if (editPicked.label === '$(trash) Delete Tag') {
        const confirm = await vscode.window.showWarningMessage(
            `Delete tag "${tagToEdit.name}"? This will remove it from all pins/folders.`,
            'Delete'
        );
        if (confirm !== 'Delete') return;

        // Remove tag from tags list
        const newTags = tags.filter(tag => tag.id !== tagToEdit.id);

        removeTagFromAllPinsAndFolders(workspaceFolder, tagToEdit.id);

        saveTags(workspaceFolder, newTags);
        pinProvider.refresh();
        vscode.window.showInformationMessage(`Tag "${tagToEdit.name}" deleted.`);
        await vscode.commands.executeCommand('codepin.tagManager');
        return;
        }
    })
    );



    // ---- SET COLOR COMMAND (supports Team/Local) ----
    const setColor = (color: string) => async (item: any) => {
    // 1. Get all selected items in the treeview
    let itemsToUpdate = treeView.selection;
    // If the right-clicked item isn't in the selection, use only the clicked item
    if (!itemsToUpdate.some(sel => sel.id === item.id)) {
        itemsToUpdate = [item];
    }

    // 2. Only allow multi-select for all Team or all Local (not mixed)
    const types = new Set(
        itemsToUpdate.map(sel => sel.pin?.type || sel.folder?.type)
    );
    if (types.size > 1) {
        vscode.window.showWarningMessage("You can only select pins/folders from either Team or Local at a time.");
        return;
    }

    // 3. Group items by file (.codepin.team.json or .codepin.local.json)
    const groupedByFile: { [file: string]: { pins: CodePin[], folders: CodePinFolder[] } } = {};
    for (const sel of itemsToUpdate) {
        const type = sel.pin?.type || sel.folder?.type;
        const pinFilePath = type === "team"
            ? path.join(workspaceFolder, ".codepin.team.json")
            : path.join(workspaceFolder, ".codepin.local.json");
        if (!groupedByFile[pinFilePath]) {
            groupedByFile[pinFilePath] = { pins: [], folders: [] };
        }
        if (sel.isFolder && sel.folder) groupedByFile[pinFilePath].folders.push(sel.folder);
        else if (sel.pin) groupedByFile[pinFilePath].pins.push(sel.pin);
    }

    // 4. Update color for all pins and folders in each file
    for (const [pinFilePath, { pins: pinsToUpdate, folders: foldersToUpdate }] of Object.entries(groupedByFile)) {
        if (!fs.existsSync(pinFilePath)) continue;
        const raw = fs.readFileSync(pinFilePath, "utf8");
        let pins: CodePin[] = [];
        let folders: CodePinFolder[] = [];
        try {
            const parsed = JSON.parse(raw);
            pins = parsed.pins || [];
            folders = parsed.folders || [];
        } catch { continue; }

        pins = pins.map((p: CodePin) =>
            pinsToUpdate.some(up => up.id === p.id)
                ? { ...p, color }
                : p
        );
        folders = folders.map((f: CodePinFolder) =>
            foldersToUpdate.some(up => up.id === f.id)
                ? { ...f, color }
                : f
        );
        fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
    }
    pinProvider.refresh();
};

    context.subscriptions.push(
        vscode.commands.registerCommand('codepin.setColorBlue', setColor("blue")),
        vscode.commands.registerCommand('codepin.setColorGreen', setColor("green")),
        vscode.commands.registerCommand('codepin.setColorPurple', setColor("purple")),
        vscode.commands.registerCommand('codepin.setColorRed', setColor("red")),
        vscode.commands.registerCommand('codepin.setColorYellow', setColor("yellow")),
        vscode.commands.registerCommand('codepin.setColorOrange', setColor("orange")),
        vscode.commands.registerCommand('codepin.setColorBrown', setColor("brown")),
        vscode.commands.registerCommand('codepin.setColorBlack', setColor("black")),
        vscode.commands.registerCommand('codepin.setColorWhite', setColor("white"))
    );

    // ---- ADD FOLDER ----
    const addFolderCommand = vscode.commands.registerCommand('codepin.addPinFolder', async () => {
        const folderTitle = await vscode.window.showInputBox({
            prompt: "Folder name"
        });
        if (!folderTitle) return;

        const folderColor = "blue";
        const options = lastSelection === 'Team' ? ['Team', 'Local'] : ['Local', 'Team'];
        const location = await vscode.window.showQuickPick(options, {
            placeHolder: 'Where do you want to add this folder?'
        });
        if (!location) return;
        if (location === "Team" || location === "Local") {
            lastSelection = location;
        }
        const isTeam = location === 'Team';


        const pinFilePath = isTeam ? path.join(workspaceFolder, ".codepin.team.json") : path.join(workspaceFolder, ".codepin.local.json");
        let pins: CodePin[] = [];
        let folders: any[] = [];
        if (fs.existsSync(pinFilePath)) {
            const raw = fs.readFileSync(pinFilePath, "utf8");
            try {
                const parsed = JSON.parse(raw);
                pins = parsed.pins || [];
                folders = parsed.folders || [];
            } catch {
                pins = [];
                folders = [];
            }
        }

        const newFolder = {
            id: uuidv4(),
            title: folderTitle,
            color: folderColor,
            order: folders.length,
            type: isTeam ? "team" : "local"
        };

        folders.push(newFolder);
        fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
        pinProvider.refresh();
    });

    // ---- ADD PIN ----
    const addPinCommand = vscode.commands.registerCommand('codepin.addPin', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active editor found.");
            return;
        }

        const selection = editor.selection;
        const filePath = editor.document.uri.fsPath;
        let line: number | [number, number];

        if (selection.start.line === selection.end.line) {
            // Single line
            line = selection.start.line;
        } else {
            // Multi-line (inclusive)
            line = [selection.start.line, selection.end.line];
        }


        const pinTitle = await vscode.window.showInputBox({
            prompt: "Give your pin a title",
        });

        if (!pinTitle) { return; }

        const options = lastSelection === 'Team' ? ['Team', 'Local'] : ['Local', 'Team'];
        const location = await vscode.window.showQuickPick(options, {
            placeHolder: 'Where do you want to add this pin?'
        });
        if (!location) return;
        if (location === "Team" || location === "Local") {
            lastSelection = location;
        }
        const isTeam = location === 'Team';

        const pinFilePath = isTeam ? path.join(workspaceFolder, ".codepin.team.json") : path.join(workspaceFolder, ".codepin.local.json");

        let pins: CodePin[] = [];
        let folders: any[] = [];

        if (fs.existsSync(pinFilePath)) {
            const raw = fs.readFileSync(pinFilePath, "utf8");
            try {
                const parsed = JSON.parse(raw);
                pins = parsed.pins || [];
                folders = parsed.folders || [];
            } catch {
                pins = [];
                folders = [];
            }
        }
        if (pins.length >= 10) {
            vscode.window.showWarningMessage(
                "CodePin Free lets you save up to 10 pins per workspace. Upgrade to Pro for unlimited pins!"
            );
            return;
        }
        
        const newPin: CodePin = {
            id: uuidv4(),
            file: path.relative(workspaceFolder, filePath),
            line,
            title: pinTitle,
            color: "red",
            type: isTeam ? "team" : "local",
            order: pins.length
        };

        pins.push(newPin);
        fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");

        let lineLabel: string;
        if (typeof line === 'number') {
            lineLabel = `line ${line + 1}`;
        } else if (Array.isArray(line)) {
            const start = Math.min(line[0], line[1]) + 1;
            const end = Math.max(line[0], line[1]) + 1;
            lineLabel = `lines ${start}-${end}`;
        } else {
            lineLabel = '(unknown line)';
        }

        vscode.window.showInformationMessage(`📍 Pinned "${pinTitle}" at ${lineLabel}`);

        pinProvider.refresh();
    });

    // ---- OPEN PIN ----
    const openPinCommand = vscode.commands.registerCommand('codepin.openPin', (item) => {
    const pin = item.pin ?? item;
    if (!pin || !pin.file) { return; }

    const filePath = path.join(workspaceFolder, pin.file);
    const uri = vscode.Uri.file(filePath);
    vscode.workspace.openTextDocument(uri).then(doc => {
        vscode.window.showTextDocument(doc).then(editor => {
            let selection: vscode.Selection | undefined;

            if (typeof pin.line === "number") {
                const pos = new vscode.Position(pin.line, 0);
                selection = new vscode.Selection(pos, pos);
            } else if (Array.isArray(pin.line)) {
                const startLine = Math.min(pin.line[0], pin.line[1]);
                const endLine = Math.max(pin.line[0], pin.line[1]);
                const start = new vscode.Position(startLine, 0);
                const end = new vscode.Position(
                    endLine,
                    doc.lineAt(endLine).text.length
                );
                selection = new vscode.Selection(start, end);
            }

            if (selection) {
                editor.selection = selection;
                editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
            }
        });
    });
});


    // ---- DELETE COMMAND ----
    const deleteCommand = vscode.commands.registerCommand('codepin.delete', async (item) => {
        let itemsToDelete = treeView.selection;
        if (!itemsToDelete.some(sel => sel.id === item.id)) {
            itemsToDelete = [item];
        }

        const types = new Set(
            itemsToDelete.map(
                sel => sel.pin?.type || sel.folder?.type
            )
        );
        if (types.size > 1) {
            vscode.window.showWarningMessage("You can only select pins/folders from either Team or Local at a time.");
            return;
        }


        // Split items into pins/folders grouped by file (team/local)
        const groupedByFile: { [file: string]: { pins: CodePin[], folders: CodePinFolder[] } } = {};
        for (const sel of itemsToDelete) {
            const type = sel.pin?.type || sel.folder?.type;
            const pinFilePath = type === "team"
                ? path.join(workspaceFolder, ".codepin.team.json")
                : path.join(workspaceFolder, ".codepin.local.json");
            if (!groupedByFile[pinFilePath]) {
                groupedByFile[pinFilePath] = { pins: [], folders: [] };
            }
            if (sel.isFolder && sel.folder) groupedByFile[pinFilePath].folders.push(sel.folder);
            else if (sel.pin) groupedByFile[pinFilePath].pins.push(sel.pin);
        }

        let totalPins = 0;
        let totalFolders = 0;

        for (const [pinFilePath, { pins: pinsToDelete, folders: foldersToDelete }] of Object.entries(groupedByFile)) {
            if (!fs.existsSync(pinFilePath)) continue;
            const raw = fs.readFileSync(pinFilePath, "utf8");
            let pins: CodePin[] = [];
            let folders: CodePinFolder[] = [];
            try {
                const parsed = JSON.parse(raw);
                pins = parsed.pins || [];
                folders = parsed.folders || [];
            } catch { continue; }

            const pinIdsToDelete = pinsToDelete.map(pin => pin.id);
            const folderIdsToDelete = foldersToDelete.map(folder => folder.id);

            // Find pins in folders that will be moved to root (not explicitly deleted)
            const pinsThatWillBeMoved = pins.filter(
                p =>
                    typeof p.parentFolderId === "string" &&
                    folderIdsToDelete.includes(p.parentFolderId) &&
                    !pinIdsToDelete.includes(p.id)
            );

            // Show dialog if any folders being deleted contain pins
            if (pinsThatWillBeMoved.length > 0) {
                const result = await vscode.window.showInformationMessage(
                    "One or more folders you’re deleting still contain pins. These pins will be moved to root. Continue?",
                    "Yes",
                    "No"
                );
                if (result !== "Yes") return;
            }

            // Find pins and folders before deleting for undo
            const pinsSnapshot = pins.filter(p => pinIdsToDelete.includes(p.id));
            const foldersSnapshot = folders.filter(f => folderIdsToDelete.includes(f.id));
            lastDeleted = { pins: pinsSnapshot, folders: foldersSnapshot, filePath: pinFilePath };

            // Remove selected pins
            pins = pins.filter(p => !pinIdsToDelete.includes(p.id));

            // Move pins from deleted folders (if not deleted directly) to root
            pins = pins.map(p => {
                if (
                    typeof p.parentFolderId === "string" &&
                    folderIdsToDelete.includes(p.parentFolderId) &&
                    !pinIdsToDelete.includes(p.id)
                ) {
                    return { ...p, parentFolderId: null };
                }
                return p;
            });

            // Remove selected folders
            folders = folders.filter(f => !folderIdsToDelete.includes(f.id));

            totalPins += pinsSnapshot.length;
            totalFolders += foldersSnapshot.length;

            // Save and refresh
            fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
        }
        pinProvider.refresh();

        const parts: string[] = [];
        if (totalPins > 0) parts.push(`${totalPins} pin${totalPins > 1 ? 's' : ''}`);
        if (totalFolders > 0) parts.push(`${totalFolders} folder${totalFolders > 1 ? 's' : ''}`);
        const msg = `Deleted ${parts.join(' and ')}.`;

        const undoBtn = await vscode.window.showInformationMessage(`${msg} Undo?`, "Undo");
        if (undoBtn === "Undo" && lastDeleted) {
            const pinFilePath = lastDeleted.filePath!;
            let restoredPins: CodePin[] = [];
            let restoredFolders: CodePinFolder[] = [];
            try {
                const rawRestore = fs.readFileSync(pinFilePath, "utf8");
                const parsed = JSON.parse(rawRestore);
                restoredPins = parsed.pins || [];
                restoredFolders = parsed.folders || [];
            } catch { }

            restoredPins = [...restoredPins, ...lastDeleted.pins.filter(rp => !restoredPins.some(p => p.id === rp.id))];
            restoredFolders = [...restoredFolders, ...lastDeleted.folders.filter(rf => !restoredFolders.some(f => f.id === rf.id))];

            fs.writeFileSync(pinFilePath, JSON.stringify({ pins: restoredPins, folders: restoredFolders }, null, 2), 'utf8');
            pinProvider.refresh();
            vscode.window.showInformationMessage(`Restored ${parts.join(' and ')}.`);
            lastDeleted = null;
        }
    });

    // ---- RENAME COMMAND ----
    const renameCommand = vscode.commands.registerCommand('codepin.rename', async (item) => {
        const isTeam = item.pin?.type === 'team' || item.folder?.type === 'team';
        const pinFilePath = isTeam
            ? path.join(workspaceFolder, ".codepin.team.json")
            : path.join(workspaceFolder, ".codepin.local.json");
        if (!fs.existsSync(pinFilePath)) { return; }

        const newTitle = await vscode.window.showInputBox({
            prompt: "Rename",
            value: item.isFolder && item.folder ? item.folder.title : (item.pin ? item.pin.title : "")
        });
        if (!newTitle) { return; }

        const raw = fs.readFileSync(pinFilePath, "utf8");
        let pins: CodePin[] = [];
        let folders: any[] = [];
        try {
            const parsed = JSON.parse(raw);
            pins = parsed.pins || [];
            folders = parsed.folders || [];
        } catch { return; }

        if (item.isFolder && item.folder) {
            folders = folders.map((f: CodePinFolder) =>
                f.id === item.folder.id ? { ...f, title: newTitle } : f
            );
        } else if (item.pin) {
            pins = pins.map((p: CodePin) =>
                p.id === item.pin.id ? { ...p, title: newTitle } : p
            );
        }
        fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
        pinProvider.refresh();
    });

        const addNoteCommand = vscode.commands.registerCommand('codepin.addNote', async (item) => {
        // Determine which JSON file to update (team/local, pin/folder)
        const isFolder = item.isFolder && item.folder;
        const filePath = isFolder
            ? (item.folder.type === "team"
                ? path.join(workspaceFolder, ".codepin.team.json")
                : path.join(workspaceFolder, ".codepin.local.json"))
            : (item.pin.type === "team"
                ? path.join(workspaceFolder, ".codepin.team.json")
                : path.join(workspaceFolder, ".codepin.local.json"));
        if (!fs.existsSync(filePath)) return;

        const note = await vscode.window.showInputBox({
            prompt: "Add a note"
        });
        if (note == null) return;

        // Read file, update note, write back
        const raw = fs.readFileSync(filePath, "utf8");
        let pins: CodePin[] = [];
        let folders: CodePinFolder[] = [];
        try {
            const parsed = JSON.parse(raw);
            pins = parsed.pins || [];
            folders = parsed.folders || [];
        } catch { return; }

        if (isFolder) {
            folders = folders.map(f => f.id === item.folder.id ? { ...f, note } : f);
        } else if (item.pin) {
            pins = pins.map(p => p.id === item.pin.id ? { ...p, note } : p);
        }

        fs.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
        pinProvider.refresh();
        });

        const editNoteCommand = vscode.commands.registerCommand('codepin.editNote', async (item) => {
        const isFolder = item.isFolder && item.folder;
        const filePath = isFolder
            ? (item.folder.type === "team"
                ? path.join(workspaceFolder, ".codepin.team.json")
                : path.join(workspaceFolder, ".codepin.local.json"))
            : (item.pin.type === "team"
                ? path.join(workspaceFolder, ".codepin.team.json")
                : path.join(workspaceFolder, ".codepin.local.json"));
        if (!fs.existsSync(filePath)) return;

        const currentNote = isFolder ? item.folder.note : item.pin.note;
        const note = await vscode.window.showInputBox({
            prompt: "Edit note",
            value: currentNote || ""
        });
        if (note == null) return;

        const raw = fs.readFileSync(filePath, "utf8");
        let pins: CodePin[] = [];
        let folders: CodePinFolder[] = [];
        try {
            const parsed = JSON.parse(raw);
            pins = parsed.pins || [];
            folders = parsed.folders || [];
        } catch { return; }

        if (isFolder) {
            folders = folders.map(f => f.id === item.folder.id ? { ...f, note } : f);
        } else if (item.pin) {
            pins = pins.map(p => p.id === item.pin.id ? { ...p, note } : p);
        }

        fs.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
        pinProvider.refresh();
        });

        const removeNoteCommand = vscode.commands.registerCommand('codepin.removeNote', async (item) => {
        const isFolder = item.isFolder && item.folder;
        const filePath = isFolder
            ? (item.folder.type === "team"
                ? path.join(workspaceFolder, ".codepin.team.json")
                : path.join(workspaceFolder, ".codepin.local.json"))
            : (item.pin.type === "team"
                ? path.join(workspaceFolder, ".codepin.team.json")
                : path.join(workspaceFolder, ".codepin.local.json"));
        if (!fs.existsSync(filePath)) return;

        const confirm = await vscode.window.showInformationMessage(
        "Remove note from this item?", "Yes", "Cancel"
        )
        if (confirm !== "Yes") return;

        const raw = fs.readFileSync(filePath, "utf8");
        let pins: CodePin[] = [];
        let folders: CodePinFolder[] = [];
        try {
            const parsed = JSON.parse(raw);
            pins = parsed.pins || [];
            folders = parsed.folders || [];
        } catch { return; }

        if (isFolder) {
            folders = folders.map(f => f.id === item.folder.id ? { ...f, note: undefined } : f);
        } else if (item.pin) {
            pins = pins.map(p => p.id === item.pin.id ? { ...p, note: undefined } : p);
        }

        fs.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
        pinProvider.refresh();
        });


    context.subscriptions.push(
        addPinCommand,
        openPinCommand,
        deleteCommand,
        renameCommand,
        addNoteCommand, 
        editNoteCommand,
        removeNoteCommand)
}

export function colorToEmoji(color: string): string {
  switch (color) {
    case 'red': return '🟥';
    case 'yellow': return '🟨';
    case 'blue': return '🟦';
    case 'green': return '🟩';
    case 'purple': return '🟪';
    case 'orange': return '🟧';
    case 'brown': return '🟫';
    case 'black': return '⬛';
    case 'white': return '⬜';
    default: return '';
  }
}

function removeTagFromAllPinsAndFolders(workspaceFolder: string, tagId: string) {
  // Helper to update one file
  function updateFile(pinFilePath: string) {
    if (!fs.existsSync(pinFilePath)) return;
    let pins: CodePin[] = [];
    let folders: CodePinFolder[] = [];
    try {
      const raw = fs.readFileSync(pinFilePath, "utf8");
      const parsed = JSON.parse(raw);
      pins = parsed.pins || [];
      folders = parsed.folders || [];
    } catch { return; }

    let changed = false;
    // Remove tag from pins
    pins = pins.map(pin => {
      if (pin.tags && pin.tags.includes(tagId)) {
        changed = true;
        return { ...pin, tags: pin.tags.filter(tid => tid !== tagId) };
      }
      return pin;
    });
    // Remove tag from folders
    folders = folders.map(folder => {
      if (folder.tags && folder.tags.includes(tagId)) {
        changed = true;
        return { ...folder, tags: folder.tags.filter(tid => tid !== tagId) };
      }
      return folder;
    });

    if (changed) {
      fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
    }
  }

  // Update both team and local
  updateFile(path.join(workspaceFolder, ".codepin.team.json"));
  updateFile(path.join(workspaceFolder, ".codepin.local.json"));
}

function searchPinsAndFoldersQuickInput(pins: CodePin[], folders: CodePinFolder[], onPick: (pin?: CodePin, folder?: CodePinFolder) => void) {
    const quickInput = vscode.window.createQuickPick<vscode.QuickPickItem>();
    quickInput.placeholder = "Search pins and folders by name or note...";

    function getLabel(item: { title?: string, name?: string }) {
        return item.title || item.name || '';
    }

    function updateItems(filter: string) {
        const lower = filter.toLowerCase();
        const pinItems = pins
            .filter(pin => pin.title.toLowerCase().includes(lower) || (pin.note?.toLowerCase().includes(lower)))
            .map(pin => ({
                label: `$(pin) ${pin.title}`,
                description: pin.type === 'team' ? 'Team Pin' : 'Local Pin',
                detail: pin.note || '',
                alwaysShow: true,
                pin,
            }));

        const folderItems = folders
            .filter(folder => folder.title.toLowerCase().includes(lower) || (folder.note?.toLowerCase().includes(lower)))
            .map(folder => ({
                label: `$(folder) ${folder.title}`,
                description: folder.type === 'team' ? 'Team Folder' : 'Local Folder',
                detail: folder.note || '',
                alwaysShow: true,
                folder,
            }));

        quickInput.items = [...folderItems, ...pinItems];
    }

    quickInput.onDidChangeValue((filter) => {
        updateItems(filter);
    });

    quickInput.onDidAccept(() => {
        const selected = quickInput.selectedItems[0];
        if ((selected as any).pin) {
            onPick((selected as any).pin, undefined);
        } else if ((selected as any).folder) {
            onPick(undefined, (selected as any).folder);
        }
        quickInput.hide();
    });

    quickInput.onDidHide(() => quickInput.dispose());

    // Initialize
    updateItems('');
    quickInput.show();
}


export function deactivate() {}