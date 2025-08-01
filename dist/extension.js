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
  colorToEmoji: () => colorToEmoji,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);

// src/pinProvider.ts
var vscode = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/tagManager.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var TAGS_FILE = ".codepin.tags.json";
function loadTags(workspaceRoot) {
  const tagsPath = path.join(workspaceRoot, TAGS_FILE);
  if (!fs.existsSync(tagsPath)) return [];
  try {
    const content = fs.readFileSync(tagsPath, "utf8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}
function saveTags(workspaceRoot, tags) {
  const tagsPath = path.join(workspaceRoot, TAGS_FILE);
  fs.writeFileSync(tagsPath, JSON.stringify(tags, null, 2), "utf8");
}

// src/pinProvider.ts
function buildTagLabel(tagIds, allTags) {
  if (!tagIds?.length) return "";
  const showTagColors = vscode.workspace.getConfiguration("codepin").get("showTagColors", true);
  return "[" + tagIds.map((id) => {
    const tag = allTags.find((t) => t.id === id);
    if (!tag) return "";
    return showTagColors ? `${colorToEmoji(tag.color)} ${tag.name}` : tag.name;
  }).filter(Boolean).join(", ") + "]";
}
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

 **Linetext:**
\`\`\`
${lineText}
\`\`\``;
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
var MAX_TOOLTIP_LINES = 10;
async function getPinLineText(pin, workspaceRoot) {
  try {
    const doc = await vscode.workspace.openTextDocument(path2.join(workspaceRoot, pin.file));
    if (typeof pin.line === "number" && pin.line < doc.lineCount) {
      return doc.lineAt(pin.line).text.trim();
    } else if (Array.isArray(pin.line)) {
      const startLine = Math.min(pin.line[0], pin.line[1]);
      const endLine = Math.max(pin.line[0], pin.line[1]);
      const lines = [];
      for (let i = startLine; i <= endLine && i < doc.lineCount; i++) {
        lines.push(doc.lineAt(i).text.trim());
      }
      let moreMsg = "";
      if (lines.length > MAX_TOOLTIP_LINES) {
        moreMsg = `
...and ${lines.length - MAX_TOOLTIP_LINES} more lines`;
      }
      return lines.slice(0, MAX_TOOLTIP_LINES).join("\n") + moreMsg;
    } else {
      return "(Line missing)";
    }
  } catch {
    return "(File missing)";
  }
}
var PinProvider = class {
  constructor(workspaceRoot, extensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.extensionContext = extensionContext;
    this.teamFile = path2.join(this.workspaceRoot, ".codepin.team.json");
    this.localFile = path2.join(this.workspaceRoot, ".codepin.local.json");
    this.loadData();
  }
  dropMimeTypes = ["application/vnd.codepin.treeitem"];
  dragMimeTypes = ["application/vnd.codepin.treeitem"];
  tags = [];
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
    this.tags = loadTags(this.workspaceRoot);
    this.loadData();
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  loadData() {
    if (fs2.existsSync(this.teamFile)) {
      try {
        const data = JSON.parse(fs2.readFileSync(this.teamFile, "utf8"));
        this.teamPins = (data.pins || []).map((p) => ({ ...p, tags: Array.isArray(p.tags) ? p.tags : [], type: "team" }));
        this.teamFolders = (data.folders || []).map((f) => ({ ...f, tags: Array.isArray(f.tags) ? f.tags : [], type: "team" }));
      } catch {
        this.teamPins = [];
        this.teamFolders = [];
      }
    } else {
      this.teamPins = [];
      this.teamFolders = [];
    }
    if (fs2.existsSync(this.localFile)) {
      try {
        const data = JSON.parse(fs2.readFileSync(this.localFile, "utf8"));
        this.localPins = (data.pins || []).map((p) => ({ ...p, tags: Array.isArray(p.tags) ? p.tags : [], type: "local" }));
        this.localFolders = (data.folders || []).map((f) => ({ ...f, tags: Array.isArray(f.tags) ? f.tags : [], type: "local" }));
      } catch {
        this.localPins = [];
        this.localFolders = [];
      }
    } else {
      this.localPins = [];
      this.localFolders = [];
    }
  }
  getParent(element) {
    if (element.isFolder && element.folder) {
      const rootLabel = element.folder.type === "team" ? "Team Pins" : "Local Pins";
      const rootId = element.folder.type === "team" ? "codepin-team-root" : "codepin-local-root";
      return new PinItem(rootLabel, vscode.TreeItemCollapsibleState.Expanded, void 0, void 0, true, rootId);
    }
    if (!element.isFolder && element.pin) {
      const pin = element.pin;
      if (pin.parentFolderId) {
        const folder = (pin.type === "team" ? this.teamFolders : this.localFolders).find((f) => f.id === pin.parentFolderId);
        if (folder) {
          return new PinItem(folder.title, vscode.TreeItemCollapsibleState.Collapsed, void 0, folder, true);
        }
      }
      const rootLabel = pin.type === "team" ? "Team Pins" : "Local Pins";
      const rootId = pin.type === "team" ? "codepin-team-root" : "codepin-local-root";
      return new PinItem(rootLabel, vscode.TreeItemCollapsibleState.Expanded, void 0, void 0, true, rootId);
    }
    return void 0;
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
        new PinItem("Team Pins", vscode.TreeItemCollapsibleState.Expanded, void 0, void 0, true, "codepin-team-root"),
        new PinItem("Local Pins", vscode.TreeItemCollapsibleState.Expanded, void 0, void 0, true, "codepin-local-root")
      ];
    }
    if (element.label === "Team Pins") {
      const folders = this.teamFolders.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => {
        let label = f.title;
        if (f.note) label = "\xB7 " + label;
        if (f.tags && f.tags.length > 0) {
          label += " " + buildTagLabel(f.tags, this.tags);
        }
        const item = new PinItem(label, vscode.TreeItemCollapsibleState.Collapsed, void 0, f, true);
        const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : "blue";
        item.iconPath = colorToFolderIcon[colorKey];
        item.tooltip = buildFolderTooltip(f);
        return item;
      });
      const rootPins = await Promise.all(
        this.teamPins.filter((p) => !p.parentFolderId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(async (pin) => {
          let label = pin.title;
          if (pin.note) label = "\xB7 " + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : "?"})`;
          }
          if (pin.tags && pin.tags.length > 0) {
            label += " " + buildTagLabel(pin.tags, this.tags);
          }
          const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, void 0, false);
          const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : "red";
          item.iconPath = colorToIcon[colorKey];
          const lineText = await getPinLineText(pin, this.workspaceRoot);
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
        if (f.tags && f.tags.length > 0) {
          label += " " + buildTagLabel(f.tags, this.tags);
        }
        const item = new PinItem(label, vscode.TreeItemCollapsibleState.Collapsed, void 0, f, true);
        const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : "blue";
        item.iconPath = colorToFolderIcon[colorKey];
        item.tooltip = buildFolderTooltip(f);
        return item;
      });
      const rootPins = await Promise.all(
        this.localPins.filter((p) => !p.parentFolderId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(async (pin) => {
          let label = pin.title;
          if (pin.note) label = "\xB7 " + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : "?"})`;
          }
          if (pin.tags && pin.tags.length > 0) {
            label += " " + buildTagLabel(pin.tags, this.tags);
          }
          const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, void 0, false);
          const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : "red";
          item.iconPath = colorToIcon[colorKey];
          const lineText = await getPinLineText(pin, this.workspaceRoot);
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
        pinArray.filter((p) => p.parentFolderId === folder.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(async (pin) => {
          let label = pin.title;
          if (pin.note) label = "\xB7 " + label;
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : "?"})`;
          }
          if (pin.tags && pin.tags.length > 0) {
            label += " " + buildTagLabel(pin.tags, this.tags);
          }
          const item = new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, void 0, false);
          const colorKey = pin.color && colorToIcon[pin.color] ? pin.color : "red";
          item.iconPath = colorToIcon[colorKey];
          const lineText = await getPinLineText(pin, this.workspaceRoot);
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
    let pinsInParent = pins.filter((p) => (p.parentFolderId || null) === parentId);
    pinsInParent = pinsInParent.filter((p) => p.id !== movedPin.id);
    const idx = pinsInParent.findIndex((p) => p.id === targetPin.id);
    pinsInParent.splice(idx + 1, 0, movedPin);
    pinsInParent.forEach((p, i) => {
      p.order = i;
    });
    for (const pin of pins) {
      if ((pin.parentFolderId || null) === parentId) {
        const updated = pinsInParent.find((p) => p.id === pin.id);
        if (updated) {
          Object.assign(pin, updated);
        }
      }
    }
  }
  getPinItemForFolder(folder) {
    return new PinItem(folder.title, vscode.TreeItemCollapsibleState.Collapsed, void 0, folder, true);
  }
  getPinItemForPin(pin) {
    let label = pin.title;
    if (pin.note) label = "\xB7 " + label;
    return new PinItem(label, vscode.TreeItemCollapsibleState.None, pin, void 0, false);
  }
  moveFolderRelativeToFolder(movedFolder, targetFolder, folders) {
    const withoutMoved = folders.filter((f) => f.id !== movedFolder.id);
    const idx = withoutMoved.findIndex((f) => f.id === targetFolder.id);
    withoutMoved.splice(idx + 1, 0, movedFolder);
    withoutMoved.forEach((folder, idx2) => {
      folder.order = idx2;
    });
    for (let i = 0; i < withoutMoved.length; i++) {
      const folder = withoutMoved[i];
      const original = folders.find((f) => f.id === folder.id);
      if (original) original.order = folder.order;
    }
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
    fs2.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    this.refresh();
  }
};
var PinItem = class extends vscode.TreeItem {
  constructor(label, collapsibleState, pin, folder, isFolder = false, explicitId) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.pin = pin;
    this.folder = folder;
    this.isFolder = isFolder;
    this.explicitId = explicitId;
    if (isFolder) {
      this.contextValue = folder?.note ? "pinFolderWithNote" : "pinFolder";
    } else {
      this.contextValue = pin?.note ? "pinItemWithNote" : "pinItem";
    }
    this.id = explicitId || (isFolder && folder ? folder.id : pin?.id || "");
  }
};

// src/extension.ts
var vscode2 = __toESM(require("vscode"));
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));

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
    if (e.affectsConfiguration("codepin.showFullPath") || e.affectsConfiguration("codepin.openPinOnClick") || e.affectsConfiguration("codepin.showTagColors")) {
      pinProvider.refresh();
    }
  });
  const treeView = vscode2.window.createTreeView("codepinView", {
    treeDataProvider: pinProvider,
    canSelectMany: true,
    dragAndDropController: pinProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);
  pinProvider.refresh();
  context.subscriptions.push(
    vscode2.commands.registerCommand("codepin.search", async () => {
      const allPins = [...pinProvider.teamPins, ...pinProvider.localPins];
      const allFolders = [...pinProvider.teamFolders, ...pinProvider.localFolders];
      searchPinsAndFoldersQuickInput(allPins, allFolders, async (pin, folder) => {
        if (pin) {
          const pinItem = pinProvider.getPinItemForPin(pin);
          try {
            await treeView.reveal(pinItem, { expand: true, select: true, focus: true });
          } catch (err) {
            vscode2.window.showWarningMessage("Could not reveal pin in tree");
          }
          vscode2.commands.executeCommand("codepin.openPin", { pin });
        } else if (folder) {
          const pinItem = pinProvider.getPinItemForFolder(folder);
          try {
            await treeView.reveal(pinItem, { expand: true, select: true, focus: true });
          } catch (err) {
            vscode2.window.showWarningMessage("Could not reveal folder in tree");
          }
        }
      });
    })
  );
  context.subscriptions.push(
    vscode2.commands.registerCommand("codepin.assignTag", async (item) => {
      if (!workspaceFolder) {
        vscode2.window.showWarningMessage("No workspace open.");
        return;
      }
      const tags = loadTags(workspaceFolder);
      if (!tags.length) {
        vscode2.window.showInformationMessage("No tags defined yet! Use the Tag Manager in the titlebar to add some.");
        return;
      }
      let currentTags = [];
      if (item.isFolder && item.folder && Array.isArray(item.folder.tags)) {
        currentTags = item.folder.tags;
      } else if (item.pin && Array.isArray(item.pin.tags)) {
        currentTags = item.pin.tags;
      }
      const pickItems = tags.map((tag) => ({
        label: `${colorToEmoji(tag.color)} ${tag.name}`,
        picked: currentTags.includes(tag.id),
        id: tag.id
      }));
      const picked = await vscode2.window.showQuickPick(pickItems, {
        placeHolder: "Assign or remove tags (multi-select)",
        canPickMany: true
      });
      if (!picked) return;
      const selectedTagIds = picked.map((p) => p.id);
      const isTeam = item.pin?.type === "team" || item.folder?.type === "team";
      const pinFilePath = isTeam ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
      if (!fs3.existsSync(pinFilePath)) return;
      let pins = [];
      let folders = [];
      try {
        const raw = fs3.readFileSync(pinFilePath, "utf8");
        const parsed = JSON.parse(raw);
        pins = parsed.pins || [];
        folders = parsed.folders || [];
      } catch {
        return;
      }
      let changed = false;
      if (item.isFolder && item.folder) {
        folders = folders.map(
          (f) => f.id === item.folder.id ? { ...f, tags: selectedTagIds } : f
        );
        changed = true;
      } else if (item.pin) {
        pins = pins.map(
          (p) => p.id === item.pin.id ? { ...p, tags: selectedTagIds } : p
        );
        changed = true;
      }
      if (changed) {
        fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
        pinProvider.refresh?.();
      }
    })
  );
  context.subscriptions.push(
    vscode2.commands.registerCommand("codepin.tagManager", async () => {
      if (!workspaceFolder) {
        vscode2.window.showWarningMessage("No workspace open.");
        return;
      }
      const tags = loadTags(workspaceFolder);
      const items = [
        { label: "$(add) Add Tag", alwaysShow: true, id: "" }
      ];
      if (tags.length > 0) {
        items.push(...tags.map((tag) => ({
          label: `${colorToEmoji(tag.color)} ${tag.name}`,
          description: "",
          // optional
          detail: "",
          // optional
          id: tag.id
        })));
      }
      const picked = await vscode2.window.showQuickPick(items, {
        placeHolder: "Tag Manager: Add, rename, or delete tags"
      });
      if (!picked) return;
      if (picked.label === "$(add) Add Tag") {
        const name = await vscode2.window.showInputBox({
          prompt: "Enter a tag name",
          validateInput: (input) => {
            if (!input.trim()) return "Tag name cannot be empty";
            if (tags.some((tag) => tag.name.toLowerCase() === input.trim().toLowerCase())) {
              return "Tag already exists";
            }
            return null;
          }
        });
        if (!name) return;
        const color = await vscode2.window.showQuickPick(
          [
            { label: "\u{1F7E5} Red", value: "red" },
            { label: "\u{1F7E8} Yellow", value: "yellow" },
            { label: "\u{1F7E6} Blue", value: "blue" },
            { label: "\u{1F7E9} Green", value: "green" },
            { label: "\u{1F7EA} Purple", value: "purple" },
            { label: "\u{1F7E7} Orange", value: "orange" },
            { label: "\u{1F7EB} Brown", value: "brown" },
            { label: "\u2B1B Black", value: "black" },
            { label: "\u2B1C White", value: "white" }
          ],
          { placeHolder: "Choose a tag color" }
        );
        if (!color) return;
        const newTag = {
          id: v4_default(),
          name: name.trim(),
          color: color.value
        };
        const newTags = [...tags, newTag];
        saveTags(workspaceFolder, newTags);
        pinProvider.refresh();
        vscode2.window.showInformationMessage(`Tag "${name.trim()}" added!`);
        await vscode2.commands.executeCommand("codepin.tagManager");
        return;
      }
      const tagToEdit = tags.find((tag) => tag.id === picked.id);
      if (!tagToEdit) return;
      const editPicked = await vscode2.window.showQuickPick([
        { label: "$(edit) Rename Tag" },
        { label: "$(symbol-color) Change Color" },
        { label: "$(trash) Delete Tag" },
        { label: "Cancel" }
      ], { placeHolder: `Edit tag: ${tagToEdit.name}` });
      if (!editPicked || editPicked.label === "Cancel") return;
      if (editPicked.label === "$(edit) Rename Tag") {
        const newName = await vscode2.window.showInputBox({
          prompt: `Rename tag "${tagToEdit.name}"`,
          value: tagToEdit.name,
          validateInput: (input) => {
            if (!input.trim()) return "Tag name cannot be empty";
            if (tags.some((tag) => tag.name.toLowerCase() === input.trim().toLowerCase() && tag.id !== tagToEdit.id)) {
              return "Another tag already has this name";
            }
            return null;
          }
        });
        if (!newName || newName === tagToEdit.name) return;
        tagToEdit.name = newName.trim();
        saveTags(workspaceFolder, tags);
        pinProvider.refresh();
        vscode2.window.showInformationMessage(`Tag renamed to "${tagToEdit.name}".`);
        await vscode2.commands.executeCommand("codepin.tagManager");
        return;
      }
      if (editPicked.label === "$(symbol-color) Change Color") {
        const newColor = await vscode2.window.showQuickPick([
          { label: "\u{1F7E5} Red", value: "red" },
          { label: "\u{1F7E8} Yellow", value: "yellow" },
          { label: "\u{1F7E6} Blue", value: "blue" },
          { label: "\u{1F7E9} Green", value: "green" },
          { label: "\u{1F7EA} Purple", value: "purple" },
          { label: "\u{1F7E7} Orange", value: "orange" },
          { label: "\u{1F7EB} Brown", value: "brown" },
          { label: "\u2B1B Black", value: "black" },
          { label: "\u2B1C White", value: "white" }
        ], { placeHolder: "Choose a new tag color" });
        if (!newColor || newColor.value === tagToEdit.color) return;
        tagToEdit.color = newColor.value;
        saveTags(workspaceFolder, tags);
        pinProvider.refresh();
        await vscode2.commands.executeCommand("codepin.tagManager");
        return;
      }
      if (editPicked.label === "$(trash) Delete Tag") {
        const confirm = await vscode2.window.showWarningMessage(
          `Delete tag "${tagToEdit.name}"? This will remove it from all pins/folders.`,
          "Delete"
        );
        if (confirm !== "Delete") return;
        const newTags = tags.filter((tag) => tag.id !== tagToEdit.id);
        removeTagFromAllPinsAndFolders(workspaceFolder, tagToEdit.id);
        saveTags(workspaceFolder, newTags);
        pinProvider.refresh();
        vscode2.window.showInformationMessage(`Tag "${tagToEdit.name}" deleted.`);
        await vscode2.commands.executeCommand("codepin.tagManager");
        return;
      }
    })
  );
  const setColor = (color) => async (item) => {
    let itemsToUpdate = treeView.selection;
    if (!itemsToUpdate.some((sel) => sel.id === item.id)) {
      itemsToUpdate = [item];
    }
    const types = new Set(
      itemsToUpdate.map((sel) => sel.pin?.type || sel.folder?.type)
    );
    if (types.size > 1) {
      vscode2.window.showWarningMessage("You can only select pins/folders from either Team or Local at a time.");
      return;
    }
    const groupedByFile = {};
    for (const sel of itemsToUpdate) {
      const type = sel.pin?.type || sel.folder?.type;
      const pinFilePath = type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
      if (!groupedByFile[pinFilePath]) {
        groupedByFile[pinFilePath] = { pins: [], folders: [] };
      }
      if (sel.isFolder && sel.folder) groupedByFile[pinFilePath].folders.push(sel.folder);
      else if (sel.pin) groupedByFile[pinFilePath].pins.push(sel.pin);
    }
    for (const [pinFilePath, { pins: pinsToUpdate, folders: foldersToUpdate }] of Object.entries(groupedByFile)) {
      if (!fs3.existsSync(pinFilePath)) continue;
      const raw = fs3.readFileSync(pinFilePath, "utf8");
      let pins = [];
      let folders = [];
      try {
        const parsed = JSON.parse(raw);
        pins = parsed.pins || [];
        folders = parsed.folders || [];
      } catch {
        continue;
      }
      pins = pins.map(
        (p) => pinsToUpdate.some((up) => up.id === p.id) ? { ...p, color } : p
      );
      folders = folders.map(
        (f) => foldersToUpdate.some((up) => up.id === f.id) ? { ...f, color } : f
      );
      fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    }
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
    const pinFilePath = isTeam ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    let pins = [];
    let folders = [];
    if (fs3.existsSync(pinFilePath)) {
      const raw = fs3.readFileSync(pinFilePath, "utf8");
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
      id: v4_default(),
      title: folderTitle,
      color: folderColor,
      order: folders.length,
      type: isTeam ? "team" : "local"
    };
    folders.push(newFolder);
    fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  const addPinCommand = vscode2.commands.registerCommand("codepin.addPin", async () => {
    const editor = vscode2.window.activeTextEditor;
    if (!editor) {
      vscode2.window.showWarningMessage("No active editor found.");
      return;
    }
    const selection = editor.selection;
    const filePath = editor.document.uri.fsPath;
    let line;
    if (selection.start.line === selection.end.line) {
      line = selection.start.line;
    } else {
      line = [selection.start.line, selection.end.line];
    }
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
    const pinFilePath = isTeam ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    let pins = [];
    let folders = [];
    if (fs3.existsSync(pinFilePath)) {
      const raw = fs3.readFileSync(pinFilePath, "utf8");
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
    const newPin = {
      id: v4_default(),
      file: path3.relative(workspaceFolder, filePath),
      line,
      title: pinTitle,
      color: "red",
      type: isTeam ? "team" : "local",
      order: pins.length
    };
    pins.push(newPin);
    fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    let lineLabel;
    if (typeof line === "number") {
      lineLabel = `line ${line + 1}`;
    } else if (Array.isArray(line)) {
      const start = Math.min(line[0], line[1]) + 1;
      const end = Math.max(line[0], line[1]) + 1;
      lineLabel = `lines ${start}-${end}`;
    } else {
      lineLabel = "(unknown line)";
    }
    vscode2.window.showInformationMessage(`\u{1F4CD} Pinned "${pinTitle}" at ${lineLabel}`);
    pinProvider.refresh();
  });
  const openPinCommand = vscode2.commands.registerCommand("codepin.openPin", (item) => {
    const pin = item.pin ?? item;
    if (!pin || !pin.file) {
      return;
    }
    const filePath = path3.join(workspaceFolder, pin.file);
    const uri = vscode2.Uri.file(filePath);
    vscode2.workspace.openTextDocument(uri).then((doc) => {
      vscode2.window.showTextDocument(doc).then((editor) => {
        let selection;
        if (typeof pin.line === "number") {
          const pos = new vscode2.Position(pin.line, 0);
          selection = new vscode2.Selection(pos, pos);
        } else if (Array.isArray(pin.line)) {
          const startLine = Math.min(pin.line[0], pin.line[1]);
          const endLine = Math.max(pin.line[0], pin.line[1]);
          const start = new vscode2.Position(startLine, 0);
          const end = new vscode2.Position(
            endLine,
            doc.lineAt(endLine).text.length
          );
          selection = new vscode2.Selection(start, end);
        }
        if (selection) {
          editor.selection = selection;
          editor.revealRange(selection, vscode2.TextEditorRevealType.InCenter);
        }
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
      const pinFilePath = type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
      if (!groupedByFile[pinFilePath]) {
        groupedByFile[pinFilePath] = { pins: [], folders: [] };
      }
      if (sel.isFolder && sel.folder) groupedByFile[pinFilePath].folders.push(sel.folder);
      else if (sel.pin) groupedByFile[pinFilePath].pins.push(sel.pin);
    }
    let totalPins = 0;
    let totalFolders = 0;
    for (const [pinFilePath, { pins: pinsToDelete, folders: foldersToDelete }] of Object.entries(groupedByFile)) {
      if (!fs3.existsSync(pinFilePath)) continue;
      const raw = fs3.readFileSync(pinFilePath, "utf8");
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
      fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
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
        const rawRestore = fs3.readFileSync(pinFilePath, "utf8");
        const parsed = JSON.parse(rawRestore);
        restoredPins = parsed.pins || [];
        restoredFolders = parsed.folders || [];
      } catch {
      }
      restoredPins = [...restoredPins, ...lastDeleted.pins.filter((rp) => !restoredPins.some((p) => p.id === rp.id))];
      restoredFolders = [...restoredFolders, ...lastDeleted.folders.filter((rf) => !restoredFolders.some((f) => f.id === rf.id))];
      fs3.writeFileSync(pinFilePath, JSON.stringify({ pins: restoredPins, folders: restoredFolders }, null, 2), "utf8");
      pinProvider.refresh();
      vscode2.window.showInformationMessage(`Restored ${parts.join(" and ")}.`);
      lastDeleted = null;
    }
  });
  const renameCommand = vscode2.commands.registerCommand("codepin.rename", async (item) => {
    const isTeam = item.pin?.type === "team" || item.folder?.type === "team";
    const pinFilePath = isTeam ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    if (!fs3.existsSync(pinFilePath)) {
      return;
    }
    const newTitle = await vscode2.window.showInputBox({
      prompt: "Rename",
      value: item.isFolder && item.folder ? item.folder.title : item.pin ? item.pin.title : ""
    });
    if (!newTitle) {
      return;
    }
    const raw = fs3.readFileSync(pinFilePath, "utf8");
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
    fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  const addNoteCommand = vscode2.commands.registerCommand("codepin.addNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    if (!fs3.existsSync(filePath)) return;
    const note = await vscode2.window.showInputBox({
      prompt: "Add a note"
    });
    if (note == null) return;
    const raw = fs3.readFileSync(filePath, "utf8");
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
    fs3.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  const editNoteCommand = vscode2.commands.registerCommand("codepin.editNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    if (!fs3.existsSync(filePath)) return;
    const currentNote = isFolder ? item.folder.note : item.pin.note;
    const note = await vscode2.window.showInputBox({
      prompt: "Edit note",
      value: currentNote || ""
    });
    if (note == null) return;
    const raw = fs3.readFileSync(filePath, "utf8");
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
    fs3.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    pinProvider.refresh();
  });
  const removeNoteCommand = vscode2.commands.registerCommand("codepin.removeNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    if (!fs3.existsSync(filePath)) return;
    const confirm = await vscode2.window.showInformationMessage(
      "Remove note from this item?",
      "Yes",
      "Cancel"
    );
    if (confirm !== "Yes") return;
    const raw = fs3.readFileSync(filePath, "utf8");
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
    fs3.writeFileSync(filePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
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
function colorToEmoji(color) {
  switch (color) {
    case "red":
      return "\u{1F7E5}";
    case "yellow":
      return "\u{1F7E8}";
    case "blue":
      return "\u{1F7E6}";
    case "green":
      return "\u{1F7E9}";
    case "purple":
      return "\u{1F7EA}";
    case "orange":
      return "\u{1F7E7}";
    case "brown":
      return "\u{1F7EB}";
    case "black":
      return "\u2B1B";
    case "white":
      return "\u2B1C";
    default:
      return "";
  }
}
function removeTagFromAllPinsAndFolders(workspaceFolder, tagId) {
  function updateFile(pinFilePath) {
    if (!fs3.existsSync(pinFilePath)) return;
    let pins = [];
    let folders = [];
    try {
      const raw = fs3.readFileSync(pinFilePath, "utf8");
      const parsed = JSON.parse(raw);
      pins = parsed.pins || [];
      folders = parsed.folders || [];
    } catch {
      return;
    }
    let changed = false;
    pins = pins.map((pin) => {
      if (pin.tags && pin.tags.includes(tagId)) {
        changed = true;
        return { ...pin, tags: pin.tags.filter((tid) => tid !== tagId) };
      }
      return pin;
    });
    folders = folders.map((folder) => {
      if (folder.tags && folder.tags.includes(tagId)) {
        changed = true;
        return { ...folder, tags: folder.tags.filter((tid) => tid !== tagId) };
      }
      return folder;
    });
    if (changed) {
      fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    }
  }
  updateFile(path3.join(workspaceFolder, ".codepin.team.json"));
  updateFile(path3.join(workspaceFolder, ".codepin.local.json"));
}
function searchPinsAndFoldersQuickInput(pins, folders, onPick) {
  const quickInput = vscode2.window.createQuickPick();
  quickInput.placeholder = "Search pins and folders by name or note...";
  function getLabel(item) {
    return item.title || item.name || "";
  }
  function updateItems(filter) {
    const lower = filter.toLowerCase();
    const pinItems = pins.filter((pin) => pin.title.toLowerCase().includes(lower) || pin.note?.toLowerCase().includes(lower)).map((pin) => ({
      label: `$(pin) ${pin.title}`,
      description: pin.type === "team" ? "Team Pin" : "Local Pin",
      detail: pin.note || "",
      alwaysShow: true,
      pin
    }));
    const folderItems = folders.filter((folder) => folder.title.toLowerCase().includes(lower) || folder.note?.toLowerCase().includes(lower)).map((folder) => ({
      label: `$(folder) ${folder.title}`,
      description: folder.type === "team" ? "Team Folder" : "Local Folder",
      detail: folder.note || "",
      alwaysShow: true,
      folder
    }));
    quickInput.items = [...folderItems, ...pinItems];
  }
  quickInput.onDidChangeValue((filter) => {
    updateItems(filter);
  });
  quickInput.onDidAccept(() => {
    const selected = quickInput.selectedItems[0];
    if (selected.pin) {
      onPick(selected.pin, void 0);
    } else if (selected.folder) {
      onPick(void 0, selected.folder);
    }
    quickInput.hide();
  });
  quickInput.onDidHide(() => quickInput.dispose());
  updateItems("");
  quickInput.show();
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  colorToEmoji,
  deactivate
});
//# sourceMappingURL=extension.js.map
