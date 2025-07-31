"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);

// src/pinProvider.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function buildPinTooltip(pin, lineText = "") {
  const showFullPath = vscode.workspace.getConfiguration("codepin").get("showFullPath", false);
  const relativeFile = pin.file.replace(/\\/g, "/");
  const justFile = relativeFile.split("/").pop();
  let lineStr = "?";
  if (typeof pin.line === "number") {
    lineStr = (pin.line + 1).toString();
  } else if (Array.isArray(pin.line)) {
    lineStr = `${pin.line[0] + 1}\u2013${pin.line[1] + 1}`;
  }
  const locationStr = showFullPath ? `${relativeFile}:${lineStr}` : `${justFile}:${lineStr}`;
  let tooltip = `**Title:** ${pin.title}

 **File:** ${locationStr}`;
  if (lineText) {
    tooltip += `

 **Linetext:** ${lineText}`;
  }
  if (pin.note) {
    tooltip += `

---

#### \u{1F4DD} Note
     ${pin.note}`;
  }
  return new vscode.MarkdownString(tooltip);
}
function buildFolderTooltip(folder) {
  let tooltip = `**Title:** ${folder.title}`;
  if (folder.note) {
    tooltip += `

---

#### \u{1F4DD} Note
     ${folder.note}`;
  }
  return new vscode.MarkdownString(tooltip);
}
var PinProvider = class {
  constructor(workspaceRoot, extensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.extensionContext = extensionContext;
    this.teamFile = path.join(this.workspaceRoot, ".codepin.team.json");
    this.localFile = path.join(this.workspaceRoot, ".codepin.local.json");
    this.loadData();
  }
  dropMimeTypes = ["application/vnd.codepin.treeitem"];
  dragMimeTypes = ["application/vnd.codepin.treeitem"];
  teamFile;
  localFile;
  teamPins = [];
  teamFolders = [];
  localPins = [];
  localFolders = [];
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  pins = [];
  folders = [];
  refresh() {
    this.loadData();
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  loadData() {
    if (fs.existsSync(this.teamFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.teamFile, "utf8"));
        this.teamPins = (data.pins || []).map((p) => ({ ...p, type: "team" }));
        this.teamFolders = (data.folders || []).map((f) => ({ ...f, type: "team" }));
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
        const data = JSON.parse(fs.readFileSync(this.localFile, "utf8"));
        this.localPins = (data.pins || []).map((p) => ({ ...p, type: "local" }));
        this.localFolders = (data.folders || []).map((f) => ({ ...f, type: "local" }));
      } catch {
        this.localPins = [];
        this.localFolders = [];
      }
    } else {
      this.localPins = [];
      this.localFolders = [];
    }
  }
  async getChildren(element) {
    const openOnClick = vscode.workspace.getConfiguration("codepin").get("openPinOnClick", true);
    const showFullPath = vscode.workspace.getConfiguration("codepin").get("showFullPath", false);
    const colorToIcon = {
      blue: this.extensionContext.asAbsolutePath("resources/pin_blue.svg"),
      green: this.extensionContext.asAbsolutePath("resources/pin_green.svg"),
      purple: this.extensionContext.asAbsolutePath("resources/pin_purple.svg"),
      red: this.extensionContext.asAbsolutePath("resources/pin_red.svg"),
      yellow: this.extensionContext.asAbsolutePath("resources/pin_yellow.svg"),
      orange: this.extensionContext.asAbsolutePath("resources/pin_orange.svg"),
      brown: this.extensionContext.asAbsolutePath("resources/pin_brown.svg"),
      black: this.extensionContext.asAbsolutePath("resources/pin_black.svg"),
      white: this.extensionContext.asAbsolutePath("resources/pin_white.svg")
    };
    const colorToFolderIcon = {
      blue: this.extensionContext.asAbsolutePath("resources/folder_blue.svg"),
      green: this.extensionContext.asAbsolutePath("resources/folder_green.svg"),
      purple: this.extensionContext.asAbsolutePath("resources/folder_purple.svg"),
      red: this.extensionContext.asAbsolutePath("resources/folder_red.svg"),
      yellow: this.extensionContext.asAbsolutePath("resources/folder_yellow.svg"),
      orange: this.extensionContext.asAbsolutePath("resources/folder_orange.svg"),
      brown: this.extensionContext.asAbsolutePath("resources/folder_brown.svg"),
      black: this.extensionContext.asAbsolutePath("resources/folder_black.svg"),
      white: this.extensionContext.asAbsolutePath("resources/folder_white.svg")
    };
    if (!element) {
      return [
        new PinItem("Team Pins", vscode.TreeItemCollapsibleState.Expanded, void 0, void 0, true),
        new PinItem("Local Pins", vscode.TreeItemCollapsibleState.Expanded, void 0, void 0, true)
      ];
    }
    if (element.label === "Team Pins") {
      const folders = this.teamFolders.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => {
        let label = f.title;
        if (f.note) label = "\xB7 " + label;
        const item = new PinItem(label, vscode.TreeItemCollapsibleState.Collapsed, void 0, f, true);
        const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : "blue";
        item.iconPath = colorToFolderIcon[colorKey];
        item.tooltip = buildFolderTooltip(f);
        return item;
      });
      const rootPins = await Promise.all(
        this.teamPins.filter((p) => !p.parentFolderId).map(async (pin) => {
          let label = pin.title;
          if (pin.note) label = "\xB7 " + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : "?"})`;
          }
          const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, void 0, false);
          const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : "red";
          item.iconPath = colorToIcon[colorKey];
          let lineText = "";
          try {
            const doc = await vscode.workspace.openTextDocument(path.join(this.workspaceRoot, pin.file));
            if (typeof pin.line === "number" && pin.line < doc.lineCount) {
              lineText = doc.lineAt(pin.line).text.trim();
            } else if (Array.isArray(pin.line) && pin.line[0] < doc.lineCount) {
              lineText = doc.lineAt(pin.line[0]).text.trim();
            } else {
              lineText = "(Line missing)";
            }
          } catch {
            lineText = "(File missing)";
          }
          item.tooltip = buildPinTooltip(pin, lineText);
          if (openOnClick) {
            item.command = {
              command: "codepin.openPin",
              title: "Open Pin",
              arguments: [pin]
            };
          }
          return item;
        })
      );
      return [...folders, ...rootPins];
    }
    if (element.label === "Local Pins") {
      const folders = this.localFolders.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => {
        let label = f.title;
        if (f.note) label = "\xB7 " + label;
        const item = new PinItem(label, vscode.TreeItemCollapsibleState.Collapsed, void 0, f, true);
        const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : "blue";
        item.iconPath = colorToFolderIcon[colorKey];
        item.tooltip = buildFolderTooltip(f);
        return item;
      });
      const rootPins = await Promise.all(
        this.localPins.filter((p) => !p.parentFolderId).map(async (pin) => {
          let label = pin.title;
          if (pin.note) label = "\xB7 " + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : "?"})`;
          }
          const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, void 0, false);
          const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : "red";
          item.iconPath = colorToIcon[colorKey];
          let lineText = "";
          try {
            const doc = await vscode.workspace.openTextDocument(path.join(this.workspaceRoot, pin.file));
            if (typeof pin.line === "number" && pin.line < doc.lineCount) {
              lineText = doc.lineAt(pin.line).text.trim();
            } else if (Array.isArray(pin.line) && pin.line[0] < doc.lineCount) {
              lineText = doc.lineAt(pin.line[0]).text.trim();
            } else {
              lineText = "(Line missing)";
            }
          } catch {
            lineText = "(File missing)";
          }
          item.tooltip = buildPinTooltip(pin, lineText);
          if (openOnClick) {
            item.command = {
              command: "codepin.openPin",
              title: "Open Pin",
              arguments: [pin]
            };
          }
          return item;
        })
      );
      return [...folders, ...rootPins];
    }
    if (element.isFolder && element.folder) {
      const folder = element.folder;
      const isTeam = folder.type === "team";
      const pinArray = isTeam ? this.teamPins : this.localPins;
      const pinsInFolder = await Promise.all(
        pinArray.filter((p) => p.parentFolderId === folder.id).map(async (pin) => {
          let label = pin.title;
          if (pin.note) label = "\xB7 " + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : "?"})`;
          }
          const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, void 0, false);
          const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : "red";
          item.iconPath = colorToIcon[colorKey];
          let lineText = "";
          try {
            const doc = await vscode.workspace.openTextDocument(path.join(this.workspaceRoot, pin.file));
            if (typeof pin.line === "number" && pin.line < doc.lineCount) {
              lineText = doc.lineAt(pin.line).text.trim();
            } else if (Array.isArray(pin.line) && pin.line[0] < doc.lineCount) {
              lineText = doc.lineAt(pin.line[0]).text.trim();
            } else {
              lineText = "(Line missing)";
            }
          } catch {
            lineText = "(File missing)";
          }
          item.tooltip = buildPinTooltip(pin, lineText);
          if (openOnClick) {
            item.command = {
              command: "codepin.openPin",
              title: "Open Pin",
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
  getPinById(id) {
    return this.pins.find((pin) => pin.id === id);
  }
  getFolderById(id) {
    return this.folders.find((folder) => folder.id === id);
  }
  movePinRelativeToPin(movedPin, targetPin, pins) {
    if (movedPin.parentFolderId !== targetPin.parentFolderId) return;
    const parentId = movedPin.parentFolderId || null;
    const pinsInParent = this.pins.filter(
      (p) => (p.parentFolderId || null) === parentId
    );
    const withoutMoved = pinsInParent.filter((p) => p.id !== movedPin.id);
    const idx = withoutMoved.findIndex((p) => p.id === targetPin.id);
    withoutMoved.splice(idx + 1, 0, movedPin);
    this.pins = [
      ...this.pins.filter((p) => (p.parentFolderId || null) !== parentId),
      ...withoutMoved
    ];
  }
  moveFolderRelativeToFolder(movedFolder, targetFolder, folders) {
    const withoutMoved = this.folders.filter((f) => f.id !== movedFolder.id);
    const idx = withoutMoved.findIndex((f) => f.id === targetFolder.id);
    withoutMoved.splice(idx + 1, 0, movedFolder);
    this.folders = withoutMoved;
    this.folders.forEach((folder, idx2) => {
      folder.order = idx2;
    });
  }
  async handleDrag(source, dataTransfer, token) {
    const type = source[0].pin?.type || source[0].folder?.type;
    const ids = source.map((item) => item.id).join(",");
    dataTransfer.set("application/vnd.codepin.treeitem", new vscode.DataTransferItem(JSON.stringify({ ids, type })));
  }
  async handleDrop(target, dataTransfer, token) {
    const data = await dataTransfer.get("application/vnd.codepin.treeitem")?.asString();
    if (!data) return;
    const { ids, type } = JSON.parse(data);
    const idArr = ids.split(",");
    const targetType = target?.pin?.type || target?.folder?.type;
    if (targetType && targetType !== type) {
      vscode.window.showWarningMessage("You can only move items within the same section (Team or Local).");
      return;
    }
    let pins = type === "team" ? this.teamPins : this.localPins;
    let folders = type === "team" ? this.teamFolders : this.localFolders;
    const draggedPins = pins.filter((p) => idArr.includes(p.id));
    const draggedFolders = folders.filter((f) => idArr.includes(f.id));
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
};
var PinItem = class extends vscode.TreeItem {
  constructor(label, collapsibleState, pin, folder, isFolder = false) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.pin = pin;
    this.folder = folder;
    this.isFolder = isFolder;
    if (isFolder) {
      this.contextValue = folder?.note ? "pinFolderWithNote" : "pinFolder";
    } else {
      this.contextValue = pin?.note ? "pinItemWithNote" : "pinItem";
    }
    this.id = isFolder && folder ? folder.id : pin?.id || "";
  }
};

// src/extension.ts
var vscode2 = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// node_modules/uuid/dist/esm/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/esm/rng.js
var import_crypto = require("crypto");
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    (0, import_crypto.randomFillSync)(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist/esm/native.js
var import_crypto2 = require("crypto");
var native_default = { randomUUID: import_crypto2.randomUUID };

// node_modules/uuid/dist/esm/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/extension.ts
function activate(context) {
  const workspaceFolder = vscode2.workspace.workspaceFolders?.[0].uri.fsPath;
  let lastSelection = "Team";
  if (!workspaceFolder) {
    vscode2.window.showWarningMessage("No workspace open.");
    return;
  }
  let lastDeleted = null;
  const pinProvider = new PinProvider(workspaceFolder, context);
  vscode2.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("codepin.showFullPath") || e.affectsConfiguration("codepin.openPinOnClick")) {
      pinProvider.refresh();
    }
  });
  const treeView = vscode2.window.createTreeView("codepinView", {
    treeDataProvider: pinProvider,
    canSelectMany: true,
    dragAndDropController: pinProvider
  });
  context.subscriptions.push(treeView);
  const setColor = (color) => async (item) => {
    const isTeam = item.pin?.type === "team" || item.folder?.type === "team";
    const pinFilePath = isTeam ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json");
    if (!fs2.existsSync(pinFilePath)) return;
    const raw = fs2.readFileSync(pinFilePath, "utf8");
    let pins = [];
    let folders = [];
    try {
      const parsed = JSON.parse(raw);
      pins = parsed.pins || [];
      folders = parsed.folders || [];
    } catch {
      return;
    }
    if (item.contextValue === "pinItem" || item.pin) {
      const pin = item.pin ?? item;
      pins = pins.map(
        (p) => p.id === pin.id ? { ...p, color } : p
      );
    }
    if (item.contextValue === "pinFolder" || item.folder) {
      const folder = item.folder ?? item;
      folders = folders.map(
        (f) => f.id === folder.id ? { ...f, color } : f
      );
    }
    fs2.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  };
  context.subscriptions.push(
    vscode2.commands.registerCommand("codepin.setColorBlue", setColor("blue")),
    vscode2.commands.registerCommand("codepin.setColorGreen", setColor("green")),
    vscode2.commands.registerCommand("codepin.setColorPurple", setColor("purple")),
    vscode2.commands.registerCommand("codepin.setColorRed", setColor("red")),
    vscode2.commands.registerCommand("codepin.setColorYellow", setColor("yellow")),
    vscode2.commands.registerCommand("codepin.setColorOrange", setColor("orange")),
    vscode2.commands.registerCommand("codepin.setColorBrown", setColor("brown")),
    vscode2.commands.registerCommand("codepin.setColorBlack", setColor("black")),
    vscode2.commands.registerCommand("codepin.setColorWhite", setColor("white"))
  );
  const addFolderCommand = vscode2.commands.registerCommand("codepin.addPinFolder", async () => {
    const folderTitle = await vscode2.window.showInputBox({
      prompt: "Folder name"
    });
    if (!folderTitle) return;
    const folderColor = "blue";
    const options = lastSelection === "Team" ? ["Team", "Local"] : ["Local", "Team"];
    const location = await vscode2.window.showQuickPick(options, {
      placeHolder: "Where do you want to add this folder?"
    });
    if (!location) return;
    if (location === "Team" || location === "Local") {
      lastSelection = location;
    }
    const isTeam = location === "Team";
    const newFolder = {
      id: v4_default(),
      title: folderTitle,
      color: folderColor,
      order: Date.now(),
      type: isTeam ? "team" : "local"
    };
    const pinFilePath = isTeam ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json");
    let pins = [];
    let folders = [];
    if (fs2.existsSync(pinFilePath)) {
      const raw = fs2.readFileSync(pinFilePath, "utf8");
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
    fs2.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  const addPinCommand = vscode2.commands.registerCommand("codepin.addPin", async () => {
    const editor = vscode2.window.activeTextEditor;
    if (!editor) {
      vscode2.window.showWarningMessage("No active editor found.");
      return;
    }
    const position = editor.selection.active;
    const filePath = editor.document.uri.fsPath;
    const line = position.line;
    const pinTitle = await vscode2.window.showInputBox({
      prompt: "Give your pin a title"
    });
    if (!pinTitle) {
      return;
    }
    const options = lastSelection === "Team" ? ["Team", "Local"] : ["Local", "Team"];
    const location = await vscode2.window.showQuickPick(options, {
      placeHolder: "Where do you want to add this pin?"
    });
    if (!location) return;
    if (location === "Team" || location === "Local") {
      lastSelection = location;
    }
    const isTeam = location === "Team";
    const newPin = {
      id: v4_default(),
      file: path2.relative(workspaceFolder, filePath),
      line,
      title: pinTitle,
      color: "red",
      type: isTeam ? "team" : "local"
    };
    const pinFilePath = isTeam ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json");
    let pins = [];
    let folders = [];
    if (fs2.existsSync(pinFilePath)) {
      const raw = fs2.readFileSync(pinFilePath, "utf8");
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
      vscode2.window.showWarningMessage(
        "CodePin Free lets you save up to 10 pins per workspace. Upgrade to Pro for unlimited pins!"
      );
      return;
    }
    pins.push(newPin);
    fs2.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    vscode2.window.showInformationMessage(`\u{1F4CD} Pinned "${pinTitle}" at line ${line + 1}`);
    pinProvider.refresh();
  });
  const openPinCommand = vscode2.commands.registerCommand("codepin.openPin", (item) => {
    const pin = item.pin ?? item;
    if (!pin || !pin.file) {
      return;
    }
    const filePath = path2.join(workspaceFolder, pin.file);
    const uri = vscode2.Uri.file(filePath);
    vscode2.workspace.openTextDocument(uri).then((doc) => {
      vscode2.window.showTextDocument(doc).then((editor) => {
        const position = new vscode2.Position(pin.line, 0);
        editor.selection = new vscode2.Selection(position, position);
        editor.revealRange(new vscode2.Range(position, position));
      });
    });
  });
  const deleteCommand = vscode2.commands.registerCommand("codepin.delete", async (item) => {
    let itemsToDelete = treeView.selection;
    if (!itemsToDelete.some((sel) => sel.id === item.id)) {
      itemsToDelete = [item];
    }
    const types = new Set(
      itemsToDelete.map(
        (sel) => sel.pin?.type || sel.folder?.type
      )
    );
    if (types.size > 1) {
      vscode2.window.showWarningMessage("You can only select pins/folders from either Team or Local at a time.");
      return;
    }
    const groupedByFile = {};
    for (const sel of itemsToDelete) {
      const type = sel.pin?.type || sel.folder?.type;
      const pinFilePath = type === "team" ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json");
      if (!groupedByFile[pinFilePath]) {
        groupedByFile[pinFilePath] = { pins: [], folders: [] };
      }
      if (sel.isFolder && sel.folder) groupedByFile[pinFilePath].folders.push(sel.folder);
      else if (sel.pin) groupedByFile[pinFilePath].pins.push(sel.pin);
    }
    let totalPins = 0;
    let totalFolders = 0;
    for (const [pinFilePath, { pins: pinsToDelete, folders: foldersToDelete }] of Object.entries(groupedByFile)) {
      if (!fs2.existsSync(pinFilePath)) continue;
      const raw = fs2.readFileSync(pinFilePath, "utf8");
      let pins = [];
      let folders = [];
      try {
        const parsed = JSON.parse(raw);
        pins = parsed.pins || [];
        folders = parsed.folders || [];
      } catch {
        continue;
      }
      const pinIdsToDelete = pinsToDelete.map((pin) => pin.id);
      const folderIdsToDelete = foldersToDelete.map((folder) => folder.id);
      const pinsThatWillBeMoved = pins.filter(
        (p) => typeof p.parentFolderId === "string" && folderIdsToDelete.includes(p.parentFolderId) && !pinIdsToDelete.includes(p.id)
      );
      if (pinsThatWillBeMoved.length > 0) {
        const result = await vscode2.window.showInformationMessage(
          "One or more folders you\u2019re deleting still contain pins. These pins will be moved to root. Continue?",
          "Yes",
          "No"
        );
        if (result !== "Yes") return;
      }
      const pinsSnapshot = pins.filter((p) => pinIdsToDelete.includes(p.id));
      const foldersSnapshot = folders.filter((f) => folderIdsToDelete.includes(f.id));
      lastDeleted = { pins: pinsSnapshot, folders: foldersSnapshot, filePath: pinFilePath };
      pins = pins.filter((p) => !pinIdsToDelete.includes(p.id));
      pins = pins.map((p) => {
        if (typeof p.parentFolderId === "string" && folderIdsToDelete.includes(p.parentFolderId) && !pinIdsToDelete.includes(p.id)) {
          return { ...p, parentFolderId: null };
        }
        return p;
      });
      folders = folders.filter((f) => !folderIdsToDelete.includes(f.id));
      totalPins += pinsSnapshot.length;
      totalFolders += foldersSnapshot.length;
      fs2.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    }
    pinProvider.refresh();
    const parts = [];
    if (totalPins > 0) parts.push(`${totalPins} pin${totalPins > 1 ? "s" : ""}`);
    if (totalFolders > 0) parts.push(`${totalFolders} folder${totalFolders > 1 ? "s" : ""}`);
    const msg = `Deleted ${parts.join(" and ")}.`;
    const undoBtn = await vscode2.window.showInformationMessage(`${msg} Undo?`, "Undo");
    if (undoBtn === "Undo" && lastDeleted) {
      const pinFilePath = lastDeleted.filePath;
      let restoredPins = [];
      let restoredFolders = [];
      try {
        const rawRestore = fs2.readFileSync(pinFilePath, "utf8");
        const parsed = JSON.parse(rawRestore);
        restoredPins = parsed.pins || [];
        restoredFolders = parsed.folders || [];
      } catch {
      }
      restoredPins = [...restoredPins, ...lastDeleted.pins.filter((rp) => !restoredPins.some((p) => p.id === rp.id))];
      restoredFolders = [...restoredFolders, ...lastDeleted.folders.filter((rf) => !restoredFolders.some((f) => f.id === rf.id))];
      fs2.writeFileSync(pinFilePath, JSON.stringify({ pins: restoredPins, folders: restoredFolders }, null, 2), "utf8");
      pinProvider.refresh();
      vscode2.window.showInformationMessage(`Restored ${parts.join(" and ")}.`);
      lastDeleted = null;
    }
  });
  const renameCommand = vscode2.commands.registerCommand("codepin.rename", async (item) => {
    const isTeam = item.pin?.type === "team" || item.folder?.type === "team";
    const pinFilePath = isTeam ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json");
    if (!fs2.existsSync(pinFilePath)) {
      return;
    }
    const newTitle = await vscode2.window.showInputBox({
      prompt: "Rename",
      value: item.isFolder && item.folder ? item.folder.title : item.pin ? item.pin.title : ""
    });
    if (!newTitle) {
      return;
    }
    const raw = fs2.readFileSync(pinFilePath, "utf8");
    let pins = [];
    let folders = [];
    try {
      const parsed = JSON.parse(raw);
      pins = parsed.pins || [];
      folders = parsed.folders || [];
    } catch {
      return;
    }
    if (item.isFolder && item.folder) {
      folders = folders.map(
        (f) => f.id === item.folder.id ? { ...f, title: newTitle } : f
      );
    } else if (item.pin) {
      pins = pins.map(
        (p) => p.id === item.pin.id ? { ...p, title: newTitle } : p
      );
    }
    fs2.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  const addNoteCommand = vscode2.commands.registerCommand("codepin.addNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json");
    if (!fs2.existsSync(filePath)) return;
    const note = await vscode2.window.showInputBox({
      prompt: "Add a note"
    });
    if (note == null) return;
    const raw = fs2.readFileSync(filePath, "utf8");
    let pins = [];
    let folders = [];
    try {
      const parsed = JSON.parse(raw);
      pins = parsed.pins || [];
      folders = parsed.folders || [];
    } catch {
      return;
    }
    if (isFolder) {
      folders = folders.map((f) => f.id === item.folder.id ? { ...f, note } : f);
    } else if (item.pin) {
      pins = pins.map((p) => p.id === item.pin.id ? { ...p, note } : p);
    }
    fs2.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  const editNoteCommand = vscode2.commands.registerCommand("codepin.editNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json");
    if (!fs2.existsSync(filePath)) return;
    const currentNote = isFolder ? item.folder.note : item.pin.note;
    const note = await vscode2.window.showInputBox({
      prompt: "Edit note",
      value: currentNote || ""
    });
    if (note == null) return;
    const raw = fs2.readFileSync(filePath, "utf8");
    let pins = [];
    let folders = [];
    try {
      const parsed = JSON.parse(raw);
      pins = parsed.pins || [];
      folders = parsed.folders || [];
    } catch {
      return;
    }
    if (isFolder) {
      folders = folders.map((f) => f.id === item.folder.id ? { ...f, note } : f);
    } else if (item.pin) {
      pins = pins.map((p) => p.id === item.pin.id ? { ...p, note } : p);
    }
    fs2.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  const removeNoteCommand = vscode2.commands.registerCommand("codepin.removeNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path2.join(workspaceFolder, ".codepin.team.json") : path2.join(workspaceFolder, ".codepin.local.json");
    if (!fs2.existsSync(filePath)) return;
    const confirm = await vscode2.window.showInformationMessage(
      "Remove note from this item?",
      "Yes",
      "Cancel"
    );
    if (confirm !== "Yes") return;
    const raw = fs2.readFileSync(filePath, "utf8");
    let pins = [];
    let folders = [];
    try {
      const parsed = JSON.parse(raw);
      pins = parsed.pins || [];
      folders = parsed.folders || [];
    } catch {
      return;
    }
    if (isFolder) {
      folders = folders.map((f) => f.id === item.folder.id ? { ...f, note: void 0 } : f);
    } else if (item.pin) {
      pins = pins.map((p) => p.id === item.pin.id ? { ...p, note: void 0 } : p);
    }
    fs2.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  context.subscriptions.push(
    addPinCommand,
    openPinCommand,
    deleteCommand,
    renameCommand,
    addNoteCommand,
    editNoteCommand,
    removeNoteCommand
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
