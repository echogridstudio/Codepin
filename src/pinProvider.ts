import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { loadTags, CodepinTag } from './tagManager';
import { colorToEmoji, reindexFolderOrders } from './extension';
import { isProUnlocked } from './utils';
import { getExtensionContext } from './extensionContext';

// Interfaces

export interface CodePin {
    id: string;
    file: string;
    line: number | [number, number];
    title: string;
    color?: string;
    parentFolderId?: string | null;
    type?: 'team' | 'local';
    note?: string;
    order?: number;
    tags?: string[];
}

export interface CodePinFolder {
    id: string;
    title: string;
    color?: string;
    type?: 'team' | 'local';
    order?: number;
    note?: string;
    tags?: string[];
}

// Tag Label Helper

function buildTagLabel(tagIds: string[], allTags: CodepinTag[]): string {
    if (!tagIds?.length) {return '';}

    const showTagColors = vscode.workspace.getConfiguration('codepin').get('showTagColors', true);
    return '[' +
        tagIds
            .map(id => {
                const tag = allTags.find(t => t.id === id);
                if (!tag) {return '';}
                return showTagColors
                    ? `${colorToEmoji(tag.color)} ${tag.name}`
                    : tag.name;
            })
            .filter(Boolean)
            .join(', ') +
        ']';
}

// Tooltip Builders

export function buildPinTooltip(pin: CodePin, lineText: string = ''): vscode.MarkdownString {
    const showFullPath = vscode.workspace.getConfiguration('codepin').get('showFullPath', false);
    const relativeFile = pin.file.replace(/\\/g, '/');
    const justFile = relativeFile.split('/').pop();

    let lineStr = '?';
    if (typeof pin.line === 'number') {
        lineStr = (pin.line + 1).toString();
    } else if (Array.isArray(pin.line)) {
        lineStr = `${pin.line[0] + 1}–${pin.line[1] + 1}`;
    }
    const locationStr = showFullPath ? `${relativeFile}:${lineStr}` : `${justFile}:${lineStr}`;

    let tooltip = `**Title:** ${pin.title}\n\n **File:** ${locationStr}`;
    if (lineText) {
        tooltip += `\n\n **Linetext:**\n\`\`\`\n${lineText}\n\`\`\``;
    }
    if (pin.note) {
        tooltip += `\n\n---\n\n#### 📝 Note\n     ${pin.note}`;
    }
    return new vscode.MarkdownString(tooltip);
}

export function buildFolderTooltip(folder: CodePinFolder): vscode.MarkdownString {
    let tooltip = `**Title:** ${folder.title}`;
    if (folder.note) {
        tooltip += `\n\n---\n\n#### 📝 Note\n     ${folder.note}`;
    }
    return new vscode.MarkdownString(tooltip);
}

// Pin Line Helper (for Tooltip)

const MAX_TOOLTIP_LINES = 10;

export async function getPinLineText(pin: CodePin, workspaceRoot: string): Promise<string> {
    try {
        const doc = await vscode.workspace.openTextDocument(path.join(workspaceRoot, pin.file));
        if (typeof pin.line === 'number' && pin.line < doc.lineCount) {
            return doc.lineAt(pin.line).text.trim();
        } else if (Array.isArray(pin.line)) {
            const startLine = Math.min(pin.line[0], pin.line[1]);
            const endLine = Math.max(pin.line[0], pin.line[1]);
            const lines: string[] = [];
            for (let i = startLine; i <= endLine && i < doc.lineCount; i++) {
                lines.push(doc.lineAt(i).text.trim());
            }
            let moreMsg = '';
            if (lines.length > MAX_TOOLTIP_LINES) {
                moreMsg = `\n...and ${lines.length - MAX_TOOLTIP_LINES} more lines`;
            }
            return lines.slice(0, MAX_TOOLTIP_LINES).join('\n') + moreMsg;
        } else {
            return '(Line missing)';
        }
    } catch {
        return '(File missing)';
    }
}

// Main PinProvider Class

export class PinProvider implements vscode.TreeDataProvider<PinItem>, vscode.TreeDragAndDropController<PinItem> {
    dropMimeTypes = ['application/vnd.codepin.treeitem'];
    dragMimeTypes = ['application/vnd.codepin.treeitem'];

    public tags: CodepinTag[] = [];

    teamFile: string;
    localFile: string;

    public teamPins: CodePin[] = [];
    public teamFolders: CodePinFolder[] = [];
    public localPins: CodePin[] = [];
    public localFolders: CodePinFolder[] = [];

    private _onDidChangeTreeData: vscode.EventEmitter<PinItem | undefined | void> = new vscode.EventEmitter<PinItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<PinItem | undefined | void> = this._onDidChangeTreeData.event;

    // List for rare lookups
    public pins: CodePin[] = [];
    public folders: CodePinFolder[] = [];

    constructor(private workspaceRoot: string, private extensionContext: vscode.ExtensionContext) {
        this.teamFile = path.join(this.workspaceRoot, '.codepin.team.json');
        this.localFile = path.join(this.workspaceRoot, '.codepin.local.json');
        this.loadData();
    }

    refresh(): void {
        this.tags = loadTags(this.workspaceRoot);
        this.loadData();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PinItem): vscode.TreeItem {
        return element;
    }

    // Load Pins and Folders from disk
    loadData() {
        // Team
        if (fs.existsSync(this.teamFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.teamFile, 'utf8'));
                this.teamPins = (data.pins || []).map((p: CodePin) => ({ ...p, tags: Array.isArray(p.tags) ? p.tags : [], type: 'team' }));
                this.teamFolders = (data.folders || []).map((f: CodePinFolder) => ({ ...f, tags: Array.isArray(f.tags) ? f.tags : [], type: 'team' }));
            } catch {
                this.teamPins = [];
                this.teamFolders = [];
            }
        } else {
            this.teamPins = [];
            this.teamFolders = [];
        }

        // Local
        if (fs.existsSync(this.localFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.localFile, 'utf8'));
                this.localPins = (data.pins || []).map((p: CodePin) => ({ ...p, tags: Array.isArray(p.tags) ? p.tags : [], type: 'local' }));
                this.localFolders = (data.folders || []).map((f: CodePinFolder) => ({ ...f, tags: Array.isArray(f.tags) ? f.tags : [], type: 'local' }));
            } catch {
                this.localPins = [];
                this.localFolders = [];
            }
        } else {
            this.localPins = [];
            this.localFolders = [];
        }
    }

    // Tree Hierarchy

    getParent(element: PinItem): PinItem | undefined {
        // Folders
        if (element.isFolder && element.folder) {
            const rootLabel = element.folder.type === 'team' ? 'Team' : 'Local';
            const rootId = element.folder.type === 'team' ? 'codepin-team-root' : 'codepin-local-root';
            return new PinItem(rootLabel, vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, rootId);
        }

        // Pins
        if (!element.isFolder && element.pin) {
            const pin = element.pin;
            if (pin.parentFolderId) {
                const folder = (pin.type === 'team' ? this.teamFolders : this.localFolders)
                    .find(f => f.id === pin.parentFolderId);
                if (folder) {
                    return new PinItem(folder.title, vscode.TreeItemCollapsibleState.Collapsed, undefined, folder, true);
                }
            }
            const rootLabel = pin.type === 'team' ? 'Team' : 'Local';
            const rootId = pin.type === 'team' ? 'codepin-team-root' : 'codepin-local-root';
            return new PinItem(rootLabel, vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, rootId);
        }

        return undefined;
    }

    // Build the Visual Tree

    async getChildren(element?: PinItem): Promise<PinItem[]> {
        const openOnClick = vscode.workspace.getConfiguration('codepin').get('openPinOnClick', true);
        const showFullPath = vscode.workspace.getConfiguration('codepin').get('showFullPath', false);

        const colorToIcon: Record<string, string> = {
            blue: this.extensionContext.asAbsolutePath('resources/pin_blue.svg'),
            green: this.extensionContext.asAbsolutePath('resources/pin_green.svg'),
            purple: this.extensionContext.asAbsolutePath('resources/pin_purple.svg'),
            red: this.extensionContext.asAbsolutePath('resources/pin_red.svg'),
            yellow: this.extensionContext.asAbsolutePath('resources/pin_yellow.svg'),
            orange: this.extensionContext.asAbsolutePath('resources/pin_orange.svg'),
            brown: this.extensionContext.asAbsolutePath('resources/pin_brown.svg'),
            black: this.extensionContext.asAbsolutePath('resources/pin_black.svg'),
            white: this.extensionContext.asAbsolutePath('resources/pin_white.svg'),
        };

        const colorToFolderIcon: Record<string, string> = {
            blue: this.extensionContext.asAbsolutePath('resources/folder_blue.svg'),
            green: this.extensionContext.asAbsolutePath('resources/folder_green.svg'),
            purple: this.extensionContext.asAbsolutePath('resources/folder_purple.svg'),
            red: this.extensionContext.asAbsolutePath('resources/folder_red.svg'),
            yellow: this.extensionContext.asAbsolutePath('resources/folder_yellow.svg'),
            orange: this.extensionContext.asAbsolutePath('resources/folder_orange.svg'),
            brown: this.extensionContext.asAbsolutePath('resources/folder_brown.svg'),
            black: this.extensionContext.asAbsolutePath('resources/folder_black.svg'),
            white: this.extensionContext.asAbsolutePath('resources/folder_white.svg'),
        };

        // Headers, Team/Local
        if (!element) {
            const context = getExtensionContext();
            if (isProUnlocked(context)) {
                return [
                    new PinItem('Team', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, 'codepin-team-root'),
                    new PinItem('Local', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, 'codepin-local-root')
                ];
            } else {
                return [
                    new PinItem('Local', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, 'codepin-local-root')
                ];
            }
        }

        // Folders & Root Pins
        if (element.label === 'Team') {
            const folders = this.teamFolders
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map(f => {
                    let label = f.title;
                    if (f.note) {label = '· ' + label;}
                    if (f.tags && f.tags.length > 0) {
                        label += ' ' + buildTagLabel(f.tags, this.tags);
                    }
                    const item = new PinItem(label, vscode.TreeItemCollapsibleState.Collapsed, undefined, f, true);
                    const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : 'blue';
                    item.iconPath = colorToFolderIcon[colorKey];
                    item.tooltip = buildFolderTooltip(f);
                    return item;
                });

            const rootPins = await Promise.all(
                this.teamPins
                    .filter(p => !p.parentFolderId)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map(async pin => {
                        let label = pin.title;
                        if (pin.note) {label = '· ' + label;}
                        if (showFullPath) {
                            label += ` (${pin.file}:${
                                typeof pin.line === "number"
                                ? pin.line + 1
                                : Array.isArray(pin.line)
                                    ? `${pin.line[0] + 1}-${pin.line[1] + 1}`
                                    : '?'
                            })`;
                        }
                        if (pin.tags && pin.tags.length > 0) {
                            label += ' ' + buildTagLabel(pin.tags, this.tags);
                        }
                        const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, undefined, false);
                        const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : 'red';
                        item.iconPath = colorToIcon[colorKey];

                        const lineText = await getPinLineText(pin, this.workspaceRoot);
                        item.tooltip = buildPinTooltip(pin, lineText);

                        if (openOnClick) {
                            item.command = {
                                command: 'codepin.openPin',
                                title: 'Open Pin',
                                arguments: [pin]
                            };
                        }
                        return item;
                    })
            );

            return [...folders, ...rootPins];
        }

        if (element.label === 'Local') {
            const folders = this.localFolders
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map(f => {
                    let label = f.title;
                    if (f.note) {label = '· ' + label;}
                    if (f.tags && f.tags.length > 0) {
                        label += ' ' + buildTagLabel(f.tags, this.tags);
                    }
                    const item = new PinItem(label, vscode.TreeItemCollapsibleState.Collapsed, undefined, f, true);
                    const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : 'blue';
                    item.iconPath = colorToFolderIcon[colorKey];
                    item.tooltip = buildFolderTooltip(f);
                    return item;
                });

            const rootPins = await Promise.all(
                this.localPins
                    .filter(p => !p.parentFolderId)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map(async pin => {
                        let label = pin.title;
                        if (pin.note) {label = '· ' + label;}
                        if (showFullPath) {
                            label += ` (${pin.file}:${
                                typeof pin.line === "number"
                                ? pin.line + 1
                                : Array.isArray(pin.line)
                                    ? `${pin.line[0] + 1}-${pin.line[1] + 1}`
                                    : '?'
                            })`;
                        }
                        if (pin.tags && pin.tags.length > 0) {
                            label += ' ' + buildTagLabel(pin.tags, this.tags);
                        }
                        const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, undefined, false);
                        const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : 'red';
                        item.iconPath = colorToIcon[colorKey];

                        const lineText = await getPinLineText(pin, this.workspaceRoot);
                        item.tooltip = buildPinTooltip(pin, lineText);

                        if (openOnClick) {
                            item.command = {
                                command: 'codepin.openPin',
                                title: 'Open Pin',
                                arguments: [pin]
                            };
                        }
                        return item;
                    })
            );
            return [...folders, ...rootPins];
        }

        // Pins inside folder
        if (element.isFolder && element.folder) {
            const folder = element.folder;
            const isTeam = folder.type === 'team';
            const pinArray = isTeam ? this.teamPins : this.localPins;

            const pinsInFolder = await Promise.all(
                pinArray
                    .filter(p => p.parentFolderId === folder.id)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map(async pin => {
                        let label = pin.title;
                        if (pin.note) {label = '· ' + label;}
                        if (showFullPath) {
                            label += ` (${pin.file}:${
                                typeof pin.line === "number"
                                ? pin.line + 1
                                : Array.isArray(pin.line)
                                    ? `${pin.line[0] + 1}-${pin.line[1] + 1}`
                                    : '?'
                            })`;

                        }
                        if (pin.tags && pin.tags.length > 0) {
                            label += ' ' + buildTagLabel(pin.tags, this.tags);
                        }
                        const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, undefined, false);
                        const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : 'red';
                        item.iconPath = colorToIcon[colorKey];

                        const lineText = await getPinLineText(pin, this.workspaceRoot);
                        item.tooltip = buildPinTooltip(pin, lineText);

                        if (openOnClick) {
                            item.command = {
                                command: 'codepin.openPin',
                                title: 'Open Pin',
                                arguments: [pin]
                            };
                        }
                        return item;
                    })
            );
            return pinsInFolder;
        }

        return [];
    }

    // Pin/Folder Lookup 

    getPinById(id: string): CodePin | undefined {
        return this.pins.find(pin => pin.id === id);
    }
    getFolderById(id: string): CodePinFolder | undefined {
        return this.folders.find(folder => folder.id === id);
    }

    getPinItemForFolder(folder: CodePinFolder): PinItem {
        return new PinItem(folder.title, vscode.TreeItemCollapsibleState.Collapsed, undefined, folder, true);
    }

    getPinItemForPin(pin: CodePin): PinItem {
        let label = pin.title;
        if (pin.note) {label = '· ' + label;}
        return new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, undefined, false);
    }

    // Drag n drop

    movePinRelativeToPin(movedPin: CodePin, targetPin: CodePin, pins: CodePin[]) {
        if (movedPin.parentFolderId !== targetPin.parentFolderId) { return; }

        // Find all siblings (same parent)
        const siblings = pins.filter(p => p.parentFolderId === movedPin.parentFolderId);

        // Ensure unique, contiguous order (fix any legacy weirdness)
        siblings.sort((a, b) => {
            const orderA = typeof a.order === "number" ? a.order : 0;
            const orderB = typeof b.order === "number" ? b.order : 0;
            return orderA - orderB;
        });
        siblings.forEach((p, idx) => p.order = idx);

        // Find pins again after normalizing order
        const pinA = siblings.find(p => p.id === movedPin.id);
        const pinB = siblings.find(p => p.id === targetPin.id);

        if (!pinA || !pinB) { return; }

        // Swap their order
        const tempOrder = pinA.order;
        pinA.order = pinB.order;
        pinB.order = tempOrder;
    }

    moveFolderRelativeToFolder(movedFolder: CodePinFolder, targetFolder: CodePinFolder, folders: CodePinFolder[]) {
        const folderA = folders.find(f => f.id === movedFolder.id);
        const folderB = folders.find(f => f.id === targetFolder.id);

        if (!folderA || !folderB || typeof folderA.order !== "number" || typeof folderB.order !== "number") {return;}

        const tempOrder = folderA.order;
        folderA.order = folderB.order;
        folderB.order = tempOrder;

        reindexFolderOrders(folders);
    }


    async handleDrag(source: readonly PinItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
        const type = source[0].pin?.type || source[0].folder?.type;
        const ids = source.map(item => item.id).join(',');
        dataTransfer.set('application/vnd.codepin.treeitem', new vscode.DataTransferItem(JSON.stringify({ ids, type })));
    }

    async handleDrop(target: PinItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
        const data = await dataTransfer.get('application/vnd.codepin.treeitem')?.asString();
        if (!data) {return;}
        const { ids, type } = JSON.parse(data) as { ids: string, type: 'team' | 'local' };
        const idArr = ids.split(',');

        const targetType = target?.pin?.type || target?.folder?.type;
        if (targetType && targetType !== type) {
            vscode.window.showWarningMessage("You can only move items within the same section (Team or Local).");
            return;
        }

        let pins = type === "team" ? this.teamPins : this.localPins;
        let folders = type === "team" ? this.teamFolders : this.localFolders;
        const draggedPins = pins.filter(p => idArr.includes(p.id));
        const draggedFolders = folders.filter(f => idArr.includes(f.id));

        for (const draggedPin of draggedPins) {
            if (target && target.pin && draggedPin.parentFolderId === target.pin.parentFolderId) {
                this.movePinRelativeToPin(draggedPin, target.pin, pins);
            } else if (target && target.folder) {
                draggedPin.parentFolderId = target.folder.id;
            } else if (!target) {
                draggedPin.parentFolderId = null;
            }
        }

        for (const draggedFolder of draggedFolders) {
            if (target && target.folder) {
                this.moveFolderRelativeToFolder(draggedFolder, target.folder, folders);
            }
        }

        const filePath = type === "team" ? this.teamFile : this.localFile;
        fs.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");

        this.refresh();
    }
}

// PinItem Tree node

export class PinItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly pin?: CodePin,
        public readonly folder?: CodePinFolder,
        public readonly isFolder: boolean = false,
        public readonly explicitId?: string
    ) {
        super(label, collapsibleState);

        if (isFolder) {
            this.contextValue = folder?.note ? 'pinFolderWithNote' : 'pinFolder';
        } else {
            this.contextValue = pin?.note ? 'pinItemWithNote' : 'pinItem';
        }
        this.id = explicitId || (isFolder && folder ? folder.id : pin?.id || '');
    }
}