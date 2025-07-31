import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface CodePin {
  id: string;
  file: string;
  line: number | [number, number];
  title: string;
  color?: string;
  parentFolderId?: string | null;
  type?: 'team' | 'local';
  note?: string;
}

export interface CodePinFolder {
  id: string;
  title: string;
  color?: string;
  type?: 'team' | 'local';
  order?: number;
  note?: string;
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
        tooltip += `\n\n **Linetext:** ${lineText}`;
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


export class PinProvider implements vscode.TreeDataProvider<PinItem>, vscode.TreeDragAndDropController<PinItem> {
  dropMimeTypes = ['application/vnd.codepin.treeitem'];
  dragMimeTypes = ['application/vnd.codepin.treeitem'];

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
      this.teamPins = (data.pins || []).map((p: CodePin) => ({ ...p, type: 'team' }));
      this.teamFolders = (data.folders || []).map((f: CodePinFolder) => ({ ...f, type: 'team' }));

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
      this.localPins = (data.pins || []).map((p: CodePin) => ({ ...p, type: 'local' }));
      this.localFolders = (data.folders || []).map((f: CodePinFolder) => ({ ...f, type: 'local' }));
    } catch {
      this.localPins = [];
      this.localFolders = [];
    }
  } else {
    this.localPins = [];
    this.localFolders = [];
  }
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
      new PinItem('Team Pins', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true),
      new PinItem('Local Pins', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, true)
    ];
  }

  // SECTION LEVEL: Show folders + root pins in each section
  if (element.label === 'Team Pins') {
    const folders = this.teamFolders
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(f => {
        let label = f.title;
        if (f.note) label = '· ' + label;
        const item = new PinItem(label, vscode.TreeItemCollapsibleState.Collapsed, undefined, f, true);
        const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : 'blue';
        item.iconPath = colorToFolderIcon[colorKey];
        item.tooltip = buildFolderTooltip(f);
        return item;
      });

    const rootPins = await Promise.all(
      this.teamPins
      .filter(p => !p.parentFolderId)
      .map(async pin => {
        let label = pin.title;
        if (pin.note) label = '· ' + label;
        if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : '?'})`;
          }
        const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, undefined, false);
      const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : 'red';
      item.iconPath = colorToIcon[colorKey];

      let lineText = '';
      try {
        const doc = await vscode.workspace.openTextDocument(path.join(this.workspaceRoot, pin.file));
        if (typeof pin.line === 'number' && pin.line < doc.lineCount) {
          lineText = doc.lineAt(pin.line).text.trim();
        } else if (Array.isArray(pin.line) && pin.line[0] < doc.lineCount) {
          lineText = doc.lineAt(pin.line[0]).text.trim();
        } else {
          lineText = '(Line missing)';
        }
      } catch {
        lineText = '(File missing)';
      }

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
        const item = new PinItem(label, vscode.TreeItemCollapsibleState.Collapsed, undefined, f, true);
        const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : 'blue';
        item.iconPath = colorToFolderIcon[colorKey];
        item.tooltip = buildFolderTooltip(f);
        return item;
      });

    const rootPins = await Promise.all(
      this.localPins
        .filter(p => !p.parentFolderId)
        .map(async pin => {
          let label = pin.title;
          if (pin.note) label = '· ' + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : '?'})`;
          }
          const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, undefined, false);
          const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : 'red';
          item.iconPath = colorToIcon[colorKey];
          let lineText = '';
          try {
            const doc = await vscode.workspace.openTextDocument(path.join(this.workspaceRoot, pin.file));
            if (typeof pin.line === 'number' && pin.line < doc.lineCount) {
              lineText = doc.lineAt(pin.line).text.trim();
            } else if (Array.isArray(pin.line) && pin.line[0] < doc.lineCount) {
              lineText = doc.lineAt(pin.line[0]).text.trim();
            } else {
              lineText = '(Line missing)';
            }
          } catch {
            lineText = '(File missing)';
          }
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
        .map(async pin => {
          let label = pin.title;
          if (pin.note) label = '· ' + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : '?'})`;
          }
          const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, undefined, false);
          const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : 'red';
          item.iconPath = colorToIcon[colorKey];
          let lineText = '';
          try {
            const doc = await vscode.workspace.openTextDocument(path.join(this.workspaceRoot, pin.file));
            if (typeof pin.line === 'number' && pin.line < doc.lineCount) {
              lineText = doc.lineAt(pin.line).text.trim();
            } else if (Array.isArray(pin.line) && pin.line[0] < doc.lineCount) {
              lineText = doc.lineAt(pin.line[0]).text.trim();
            } else {
              lineText = '(Line missing)';
            }
          } catch {
            lineText = '(File missing)';
          }
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
    const pinsInParent = this.pins.filter(
      p => (p.parentFolderId || null) === parentId
    );
    const withoutMoved = pinsInParent.filter(p => p.id !== movedPin.id);
    const idx = withoutMoved.findIndex(p => p.id === targetPin.id);
    withoutMoved.splice(idx + 1, 0, movedPin);

    this.pins = [
      ...this.pins.filter(p => (p.parentFolderId || null) !== parentId),
      ...withoutMoved,
    ];
  }

  moveFolderRelativeToFolder(movedFolder: CodePinFolder, targetFolder: CodePinFolder, folders: CodePinFolder []) {
    const withoutMoved = this.folders.filter(f => f.id !== movedFolder.id);
    const idx = withoutMoved.findIndex(f => f.id === targetFolder.id);
    withoutMoved.splice(idx + 1, 0, movedFolder);
    this.folders = withoutMoved;
    this.folders.forEach((folder, idx) => {
    folder.order = idx;
  });
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
    public readonly isFolder: boolean = false
  ) {
    super(label, collapsibleState);

    // Set contextValue for context menu logic
    if (isFolder) {
      this.contextValue = folder?.note ? 'pinFolderWithNote' : 'pinFolder';
    } else {
      this.contextValue = pin?.note ? 'pinItemWithNote' : 'pinItem';
    }
    this.id = isFolder && folder ? folder.id : pin?.id || '';
  }
}
