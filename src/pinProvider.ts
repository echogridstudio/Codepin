import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { loadTags, CodepinTag } from './tagManager';
import {colorToEmoji} from './extension'

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



function buildTagLabel(tagIds: string[], allTags: CodepinTag[]): string {
  if (!tagIds?.length) return '';

  const showTagColors = vscode.workspace.getConfiguration('codepin').get('showTagColors', true);
  return '[' + tagIds
    .map(id => {
      const tag = allTags.find(t => t.id === id);
      if (!tag) return '';
      // Only show color if enabled
      return showTagColors
        ? `${colorToEmoji(tag.color)} ${tag.name}`
        : tag.name;
    })
    .filter(Boolean)
    .join(', ')
    + ']';
}


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

const MAX_TOOLTIP_LINES = 10;

export async function getPinLineText(
    pin: CodePin,
    workspaceRoot: string
): Promise<string> {
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

  loadData() {

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

  getParent(element: PinItem): PinItem | undefined {
  // Folder parent: section header
  if (element.isFolder && element.folder) {
    const rootLabel = element.folder.type === 'team' ? 'Team Pins' : 'Local Pins';
    const rootId = element.folder.type === 'team' ? 'codepin-team-root' : 'codepin-local-root';
    return new PinItem(rootLabel, vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, rootId);
  }

  // Pin parent: folder or section header
  if (!element.isFolder && element.pin) {
    const pin = element.pin;  // <-- THIS is the magic trick!
    if (pin.parentFolderId) {
        const folder = (pin.type === 'team' ? this.teamFolders : this.localFolders)
            .find(f => f.id === pin.parentFolderId);
        if (folder) {
            return new PinItem(folder.title, vscode.TreeItemCollapsibleState.Collapsed, undefined, folder, true);
        }
    }
    // Pin is root-level: parent is section
    const rootLabel = pin.type === 'team' ? 'Team Pins' : 'Local Pins';
    const rootId = pin.type === 'team' ? 'codepin-team-root' : 'codepin-local-root';
    return new PinItem(rootLabel, vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, rootId);
  }


  return undefined;
}




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

  // TOP LEVEL: Show Team/Local section headers
  if (!element) {
    return [
      new PinItem('Team Pins', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, 'codepin-team-root'),
      new PinItem('Local Pins', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true, 'codepin-local-root')
    ];
  }

  // SECTION LEVEL: Show folders + root pins in each section
  if (element.label === 'Team Pins') {
    const folders = this.teamFolders
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(f => {
        let label = f.title;
        if (f.note) label = '· ' + label;
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
        if (pin.note) label = '· ' + label;
        if (showFullPath) {
          label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : '?'})`;
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

  if (element.label === 'Local Pins') {
    const folders = this.localFolders
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(f => {
        let label = f.title;
        if (f.note) label = '· ' + label;
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
          if (pin.note) label = '· ' + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : '?'})`;
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

  // FOLDER LEVEL: Show pins within the given folder (from the correct section)
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
          if (pin.note) label = '· ' + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : '?'})`;
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



  getPinById(id: string): CodePin | undefined {
    return this.pins.find(pin => pin.id === id);
  }

  getFolderById(id: string): CodePinFolder | undefined {
    return this.folders.find(folder => folder.id === id);
  }

  movePinRelativeToPin(movedPin: CodePin, targetPin: CodePin, pins: CodePin[]) {
    if (movedPin.parentFolderId !== targetPin.parentFolderId) return;

    const parentId = movedPin.parentFolderId || null;
    // Only the pins within the same parent (folder or root)
    let pinsInParent = pins.filter(p => (p.parentFolderId || null) === parentId);

    // Remove moved pin from its current spot
    pinsInParent = pinsInParent.filter(p => p.id !== movedPin.id);

    // Find the target index (where to insert moved pin)
    const idx = pinsInParent.findIndex(p => p.id === targetPin.id);
    pinsInParent.splice(idx + 1, 0, movedPin);

    // Update 'order' field for all pins in this parent
    pinsInParent.forEach((p, i) => { p.order = i; });

    // Update the pins array
    // (Replace all pins in this parent with the new order, leave others unchanged)
    for (const pin of pins) {
        if ((pin.parentFolderId || null) === parentId) {
            const updated = pinsInParent.find(p => p.id === pin.id);
            if (updated) {
                Object.assign(pin, updated); // Copy new order over
            }
        }
    }
}
  getPinItemForFolder(folder: CodePinFolder): PinItem {
  // Always create a new PinItem as in your getChildren
  return new PinItem(folder.title, vscode.TreeItemCollapsibleState.Collapsed, undefined, folder, true);
}

getPinItemForPin(pin: CodePin): PinItem {
    let label = pin.title;
    if (pin.note) label = '· ' + label;
    // If you show path in label, add it here.
    return new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, undefined, false);
}



  moveFolderRelativeToFolder(movedFolder: CodePinFolder, targetFolder: CodePinFolder, folders: CodePinFolder[]) {
    // Only use the folders array that's passed in (team or local)
    const withoutMoved = folders.filter(f => f.id !== movedFolder.id);
    const idx = withoutMoved.findIndex(f => f.id === targetFolder.id);
    withoutMoved.splice(idx + 1, 0, movedFolder);

    // Re-assign order for ALL folders in this list
    withoutMoved.forEach((folder, idx) => {
        folder.order = idx;
    });

    // Update the original array in place
    for (let i = 0; i < withoutMoved.length; i++) {
        const folder = withoutMoved[i];
        const original = folders.find(f => f.id === folder.id);
        if (original) original.order = folder.order;
    }
}


  async handleDrag(source: readonly PinItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
    // All selected items must have the same type
    const type = source[0].pin?.type || source[0].folder?.type;
    // Send both IDs and type
    const ids = source.map(item => item.id).join(',');
    dataTransfer.set('application/vnd.codepin.treeitem', new vscode.DataTransferItem(JSON.stringify({ ids, type })));
}

  async handleDrop(target: PinItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
    const data = await dataTransfer.get('application/vnd.codepin.treeitem')?.asString();
    if (!data) return;

    const { ids, type } = JSON.parse(data) as { ids: string, type: 'team' | 'local' };
    const idArr = ids.split(',');

    // Target type (if dropping onto a folder/pin)
    const targetType = target?.pin?.type || target?.folder?.type;
    if (targetType && targetType !== type) {
        vscode.window.showWarningMessage("You can only move items within the same section (Team or Local).");
        return;
    }

    // Choose the correct arrays
    let pins = type === "team" ? this.teamPins : this.localPins;
    let folders = type === "team" ? this.teamFolders : this.localFolders;

    // Find dragged items
    const draggedPins = pins.filter(p => idArr.includes(p.id));
    const draggedFolders = folders.filter(f => idArr.includes(f.id));

    // Only implement pin reordering as before, within section
    for (const draggedPin of draggedPins) {
        if (target && target.pin && draggedPin.parentFolderId === target.pin.parentFolderId) {
            this.movePinRelativeToPin(draggedPin, target.pin, pins);
        } else if (target && target.folder) {
            // Move into a folder
            draggedPin.parentFolderId = target.folder.id;
        } else if (!target) {
            // Move to root
            draggedPin.parentFolderId = null;
        }
    }

    // Folders: reorder only if same type and valid
    for (const draggedFolder of draggedFolders) {
        if (target && target.folder) {
            this.moveFolderRelativeToFolder(draggedFolder, target.folder, folders);
        }
    }

    // Save changes
    const filePath = type === "team" ? this.teamFile : this.localFile;
    fs.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");

    this.refresh();
  }

}

export class PinItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly pin?: CodePin,
    public readonly folder?: CodePinFolder,
    public readonly isFolder: boolean = false,
    public readonly explicitId?: string // <-- add this
  ) {
    super(label, collapsibleState);

    // Set contextValue for context menu logic
    if (isFolder) {
      this.contextValue = folder?.note ? 'pinFolderWithNote' : 'pinFolder';
    } else {
      this.contextValue = pin?.note ? 'pinItemWithNote' : 'pinItem';
    }
    this.id = explicitId || (isFolder && folder ? folder.id : pin?.id || '');

  }
}
