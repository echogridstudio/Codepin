import { PinProvider, CodePin, CodePinFolder } from './pinProvider';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
        if (e.affectsConfiguration('codepin.showFullPath') || e.affectsConfiguration('codepin.openPinOnClick')) {
            pinProvider.refresh();
        }
    });

    const treeView = vscode.window.createTreeView('codepinView', {
        treeDataProvider: pinProvider,
        canSelectMany: true,
        dragAndDropController: pinProvider
    });
    context.subscriptions.push(treeView);

    // ---- SET COLOR COMMAND (supports Team/Local) ----
    const setColor = (color: string) => async (item: any) => {
        const isTeam = item.pin?.type === 'team' || item.folder?.type === 'team';
        const pinFilePath = isTeam
            ? path.join(workspaceFolder, ".codepin.team.json")
            : path.join(workspaceFolder, ".codepin.local.json");

        if (!fs.existsSync(pinFilePath)) return;
        const raw = fs.readFileSync(pinFilePath, "utf8");
        let pins: CodePin[] = [];
        let folders: any[] = [];
        try {
            const parsed = JSON.parse(raw);
            pins = parsed.pins || [];
            folders = parsed.folders || [];
        } catch { return; }

        if (item.contextValue === 'pinItem' || item.pin) {
            const pin = item.pin ?? item;
            pins = pins.map((p: CodePin) =>
                p.id === pin.id
                    ? { ...p, color }
                    : p
            );
        }

        if (item.contextValue === 'pinFolder' || item.folder) {
            const folder = item.folder ?? item;
            folders = folders.map((f: CodePinFolder) =>
                f.id === folder.id
                    ? { ...f, color }
                    : f
            );
        }
        fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), 'utf8');
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

        const newFolder = {
            id: uuidv4(),
            title: folderTitle,
            color: folderColor,
            order: (Date.now()),
            type: isTeam ? "team" : "local"
        };

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

        const position = editor.selection.active;
        const filePath = editor.document.uri.fsPath;
        const line = position.line;

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

        const newPin: CodePin = {
            id: uuidv4(),
            file: path.relative(workspaceFolder, filePath),
            line,
            title: pinTitle,
            color: "red",
            type: isTeam ? "team" : "local"
        };

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

        pins.push(newPin);
        fs.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");

        vscode.window.showInformationMessage(`📍 Pinned "${pinTitle}" at line ${line + 1}`);
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
                const position = new vscode.Position(pin.line, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position));
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

export function deactivate() {}
