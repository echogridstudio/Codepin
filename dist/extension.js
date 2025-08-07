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
  FREE_LIMITS: () => FREE_LIMITS,
  activate: () => activate,
  colorToEmoji: () => colorToEmoji,
  deactivate: () => deactivate,
  reindexFolderOrders: () => reindexFolderOrders
});
module.exports = __toCommonJS(extension_exports);

// src/pinProvider.ts
var vscode2 = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/tagManager.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var TAGS_FILE = ".codepin.tags.json";
function loadTags(workspaceRoot) {
  const tagsPath = path.join(workspaceRoot, TAGS_FILE);
  if (!fs.existsSync(tagsPath)) {
    return [];
  }
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

// src/utils.ts
var vscode = __toESM(require("vscode"));
function isProUnlocked(context) {
  return context.globalState.get("codepinProUnlocked", false) || !!vscode.workspace.getConfiguration("codepin").get("proLicenseKey");
}
function showUpgradePrompt(message) {
  vscode.window.showInformationMessage(
    message,
    "Upgrade to Pro"
  ).then((selection) => {
    if (selection === "Upgrade to Pro") {
      vscode.env.openExternal(vscode.Uri.parse("https://echogrid.gumroad.com/l/codepinprolicensekey"));
    }
  });
}

// src/extensionContext.ts
var extensionContext;
function setExtensionContext(ctx) {
  extensionContext = ctx;
}
function getExtensionContext() {
  return extensionContext;
}

// src/pinProvider.ts
function buildTagLabel(tagIds, allTags) {
  if (!tagIds?.length) {
    return "";
  }
  const showTagColors = vscode2.workspace.getConfiguration("codepin").get("showTagColors", true);
  return "[" + tagIds.map((id) => {
    const tag = allTags.find((t) => t.id === id);
    if (!tag) {
      return "";
    }
    return showTagColors ? `${colorToEmoji(tag.color)} ${tag.name}` : tag.name;
  }).filter(Boolean).join(", ") + "]";
}
function buildPinTooltip(pin, lineText = "") {
  const showFullPath = vscode2.workspace.getConfiguration("codepin").get("showFullPath", false);
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
  return new vscode2.MarkdownString(tooltip);
}
function buildFolderTooltip(folder) {
  let tooltip = `**Title:** ${folder.title}`;
  if (folder.note) {
    tooltip += `

---

#### \u{1F4DD} Note
     ${folder.note}`;
  }
  return new vscode2.MarkdownString(tooltip);
}
var MAX_TOOLTIP_LINES = 10;
async function getPinLineText(pin, workspaceRoot) {
  try {
    const doc = await vscode2.workspace.openTextDocument(path2.join(workspaceRoot, pin.file));
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
  constructor(workspaceRoot, extensionContext2) {
    this.workspaceRoot = workspaceRoot;
    this.extensionContext = extensionContext2;
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
  _onDidChangeTreeData = new vscode2.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  // List for rare lookups
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
  // Load Pins and Folders from disk
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
  // Tree Hierarchy
  getParent(element) {
    if (element.isFolder && element.folder) {
      const rootLabel = element.folder.type === "team" ? "Team" : "Local";
      const rootId = element.folder.type === "team" ? "codepin-team-root" : "codepin-local-root";
      return new PinItem(rootLabel, vscode2.TreeItemCollapsibleState.Expanded, void 0, void 0, true, rootId);
    }
    if (!element.isFolder && element.pin) {
      const pin = element.pin;
      if (pin.parentFolderId) {
        const folder = (pin.type === "team" ? this.teamFolders : this.localFolders).find((f) => f.id === pin.parentFolderId);
        if (folder) {
          return new PinItem(folder.title, vscode2.TreeItemCollapsibleState.Collapsed, void 0, folder, true);
        }
      }
      const rootLabel = pin.type === "team" ? "Team" : "Local";
      const rootId = pin.type === "team" ? "codepin-team-root" : "codepin-local-root";
      return new PinItem(rootLabel, vscode2.TreeItemCollapsibleState.Expanded, void 0, void 0, true, rootId);
    }
    return void 0;
  }
  // Build the Visual Tree
  async getChildren(element) {
    const openOnClick = vscode2.workspace.getConfiguration("codepin").get("openPinOnClick", true);
    const showFullPath = vscode2.workspace.getConfiguration("codepin").get("showFullPath", false);
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
      const context = getExtensionContext();
      if (isProUnlocked(context)) {
        return [
          new PinItem("Team", vscode2.TreeItemCollapsibleState.Expanded, void 0, void 0, true, "codepin-team-root"),
          new PinItem("Local", vscode2.TreeItemCollapsibleState.Expanded, void 0, void 0, true, "codepin-local-root")
        ];
      } else {
        return [
          new PinItem("Local", vscode2.TreeItemCollapsibleState.Expanded, void 0, void 0, true, "codepin-local-root")
        ];
      }
    }
    if (element.label === "Team") {
      const folders = this.teamFolders.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => {
        let label = f.title;
        if (f.note) {
          label = "\xB7 " + label;
        }
        if (f.tags && f.tags.length > 0) {
          label += " " + buildTagLabel(f.tags, this.tags);
        }
        const item = new PinItem(label, vscode2.TreeItemCollapsibleState.Collapsed, void 0, f, true);
        const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : "blue";
        item.iconPath = colorToFolderIcon[colorKey];
        item.tooltip = buildFolderTooltip(f);
        return item;
      });
      const rootPins = await Promise.all(
        this.teamPins.filter((p) => !p.parentFolderId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(async (pin) => {
          let label = pin.title;
          if (pin.note) {
            label = "\xB7 " + label;
          }
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : Array.isArray(pin.line) ? `${pin.line[0] + 1}-${pin.line[1] + 1}` : "?"})`;
          }
          if (pin.tags && pin.tags.length > 0) {
            label += " " + buildTagLabel(pin.tags, this.tags);
          }
          const item = new PinItem(label, vscode2.TreeItemCollapsibleState.None, pin, void 0, false);
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
    if (element.label === "Local") {
      const folders = this.localFolders.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => {
        let label = f.title;
        if (f.note) {
          label = "\xB7 " + label;
        }
        if (f.tags && f.tags.length > 0) {
          label += " " + buildTagLabel(f.tags, this.tags);
        }
        const item = new PinItem(label, vscode2.TreeItemCollapsibleState.Collapsed, void 0, f, true);
        const colorKey = f.color && colorToFolderIcon[f.color] ? f.color : "blue";
        item.iconPath = colorToFolderIcon[colorKey];
        item.tooltip = buildFolderTooltip(f);
        return item;
      });
      const rootPins = await Promise.all(
        this.localPins.filter((p) => !p.parentFolderId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(async (pin) => {
          let label = pin.title;
          if (pin.note) {
            label = "\xB7 " + label;
          }
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : Array.isArray(pin.line) ? `${pin.line[0] + 1}-${pin.line[1] + 1}` : "?"})`;
          }
          if (pin.tags && pin.tags.length > 0) {
            label += " " + buildTagLabel(pin.tags, this.tags);
          }
          const item = new PinItem(label, vscode2.TreeItemCollapsibleState.None, pin, void 0, false);
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
          if (pin.note) {
            label = "\xB7 " + label;
          }
          if (showFullPath) {
            label += ` (${pin.file}:${typeof pin.line === "number" ? pin.line + 1 : Array.isArray(pin.line) ? `${pin.line[0] + 1}-${pin.line[1] + 1}` : "?"})`;
          }
          if (pin.tags && pin.tags.length > 0) {
            label += " " + buildTagLabel(pin.tags, this.tags);
          }
          const item = new PinItem(label, vscode2.TreeItemCollapsibleState.None, pin, void 0, false);
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
  // Pin/Folder Lookup 
  getPinById(id) {
    return this.pins.find((pin) => pin.id === id);
  }
  getFolderById(id) {
    return this.folders.find((folder) => folder.id === id);
  }
  getPinItemForFolder(folder) {
    return new PinItem(folder.title, vscode2.TreeItemCollapsibleState.Collapsed, void 0, folder, true);
  }
  getPinItemForPin(pin) {
    let label = pin.title;
    if (pin.note) {
      label = "\xB7 " + label;
    }
    return new PinItem(label, vscode2.TreeItemCollapsibleState.None, pin, void 0, false);
  }
  // Drag n drop
  movePinRelativeToPin(movedPin, targetPin, pins) {
    if (movedPin.parentFolderId !== targetPin.parentFolderId) {
      return;
    }
    const siblings = pins.filter((p) => p.parentFolderId === movedPin.parentFolderId);
    siblings.sort((a, b) => {
      const orderA = typeof a.order === "number" ? a.order : 0;
      const orderB = typeof b.order === "number" ? b.order : 0;
      return orderA - orderB;
    });
    siblings.forEach((p, idx) => p.order = idx);
    const pinA = siblings.find((p) => p.id === movedPin.id);
    const pinB = siblings.find((p) => p.id === targetPin.id);
    if (!pinA || !pinB) {
      return;
    }
    const tempOrder = pinA.order;
    pinA.order = pinB.order;
    pinB.order = tempOrder;
  }
  moveFolderRelativeToFolder(movedFolder, targetFolder, folders) {
    const folderA = folders.find((f) => f.id === movedFolder.id);
    const folderB = folders.find((f) => f.id === targetFolder.id);
    if (!folderA || !folderB || typeof folderA.order !== "number" || typeof folderB.order !== "number") {
      return;
    }
    const tempOrder = folderA.order;
    folderA.order = folderB.order;
    folderB.order = tempOrder;
    reindexFolderOrders(folders);
  }
  async handleDrag(source, dataTransfer, token) {
    const type = source[0].pin?.type || source[0].folder?.type;
    const ids = source.map((item) => item.id).join(",");
    dataTransfer.set("application/vnd.codepin.treeitem", new vscode2.DataTransferItem(JSON.stringify({ ids, type })));
  }
  async handleDrop(target, dataTransfer, token) {
    const data = await dataTransfer.get("application/vnd.codepin.treeitem")?.asString();
    if (!data) {
      return;
    }
    const { ids, type } = JSON.parse(data);
    const idArr = ids.split(",");
    const targetType = target?.pin?.type || target?.folder?.type;
    if (targetType && targetType !== type) {
      vscode2.window.showWarningMessage("You can only move items within the same section (Team or Local).");
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
var PinItem = class extends vscode2.TreeItem {
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
var vscode3 = __toESM(require("vscode"));
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

// src/constants.ts
var ALL_COLORS = [
  { label: "\u{1F7E5} Red", value: "red" },
  { label: "\u{1F7E8} Yellow", value: "yellow" },
  { label: "\u{1F7E6} Blue", value: "blue" },
  { label: "\u{1F7E9} Green", value: "green" },
  { label: "\u{1F7EA} Purple", value: "purple" },
  { label: "\u{1F7E7} Orange", value: "orange" },
  { label: "\u{1F7EB} Brown", value: "brown" },
  { label: "\u2B1B Black", value: "black" },
  { label: "\u2B1C White", value: "white" }
];
var FREE_COLORS = ALL_COLORS.slice(0, 5);

// src/extension.ts
var FREE_LIMITS = {
  pins: 20,
  folders: 5,
  tags: 5,
  colors: 5
};
function activate(context) {
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0].uri.fsPath;
  setExtensionContext(context);
  if (!workspaceFolder) {
    vscode3.window.showWarningMessage("No workspace open.");
    return;
  }
  let lastDeleted = null;
  const pinProvider = new PinProvider(workspaceFolder, context);
  vscode3.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("codepin.showFullPath") || e.affectsConfiguration("codepin.openPinOnClick") || e.affectsConfiguration("codepin.showTagColors")) {
      pinProvider.refresh();
    }
  });
  const treeView = vscode3.window.createTreeView("codepinView", {
    treeDataProvider: pinProvider,
    canSelectMany: true,
    dragAndDropController: pinProvider,
    showCollapseAll: false
  });
  context.subscriptions.push(treeView);
  pinProvider.refresh();
  const productId = "uWbookuatJS4rNHY9UiABg==";
  const enterLicenseCommand = vscode3.commands.registerCommand("codepin.enterProLicenseKey", async () => {
    const licenseKey = await vscode3.window.showInputBox({
      prompt: "Enter your Codepin Pro license key",
      ignoreFocusOut: true,
      placeHolder: "Paste your Gumroad license key here"
    });
    if (!licenseKey) {
      return;
    }
    vscode3.window.withProgress({
      location: vscode3.ProgressLocation.Notification,
      title: "Validating license key...",
      cancellable: false
    }, async () => {
      try {
        const isValid = await validateGumroadLicense(licenseKey);
        if (isValid) {
          await context.globalState.update("codepinProUnlocked", true);
          await vscode3.workspace.getConfiguration("codepin").update("proLicenseKey", licenseKey, vscode3.ConfigurationTarget.Global);
          vscode3.window.showInformationMessage("\u2B50 Codepin Pro unlocked! Enjoy all features.");
          vscode3.commands.executeCommand("workbench.view.explorer");
          pinProvider.refresh();
        } else {
          vscode3.window.showErrorMessage("\u274C Invalid license key. Please check your Gumroad receipt or contact support.");
        }
      } catch (err) {
        let msg = "Unknown error";
        if (err instanceof Error) {
          msg = err.message;
        } else if (typeof err === "string") {
          msg = err;
        }
        vscode3.window.showErrorMessage("$(error) Error validating license: " + msg);
      }
    });
  });
  context.subscriptions.push(enterLicenseCommand);
  async function validateGumroadLicense(licenseKey) {
    const response = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product_id: productId,
        license_key: licenseKey,
        increment_uses_count: "false"
      }).toString()
    });
    if (!response.ok) {
      console.log("Gumroad API error status:", response.status);
      return false;
    }
    const data = await response.json();
    console.log("Gumroad API response:", data);
    return data.success && data.purchase && !data.purchase.refunded && !data.purchase.chargebacked && !data.purchase.disputed && !data.purchase.subscription_cancelled;
  }
  context.subscriptions.push(
    vscode3.commands.registerCommand("codepin.search", async () => {
      const allPins = [...pinProvider.teamPins, ...pinProvider.localPins];
      const allFolders = [...pinProvider.teamFolders, ...pinProvider.localFolders];
      searchPinsAndFoldersQuickInput(allPins, allFolders, async (pin, folder) => {
        if (pin) {
          const pinItem = pinProvider.getPinItemForPin(pin);
          try {
            await treeView.reveal(pinItem, { expand: true, select: true, focus: true });
          } catch (err) {
            vscode3.window.showWarningMessage("Could not reveal pin in tree");
          }
          vscode3.commands.executeCommand("codepin.openPin", { pin });
        } else if (folder) {
          const pinItem = pinProvider.getPinItemForFolder(folder);
          try {
            await treeView.reveal(pinItem, { expand: true, select: true, focus: true });
          } catch (err) {
            vscode3.window.showWarningMessage("Could not reveal folder in tree");
          }
        }
      });
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codepin.assignTag", async (item) => {
      if (!workspaceFolder) {
        vscode3.window.showWarningMessage("No workspace open.");
        return;
      }
      let itemsToUpdate = treeView.selection;
      if (!itemsToUpdate.some((sel) => sel.id === item.id)) {
        itemsToUpdate = [item];
      }
      const types = new Set(itemsToUpdate.map((sel) => sel.pin?.type || sel.folder?.type));
      if (types.size > 1) {
        vscode3.window.showWarningMessage("You can only select pins/folders from either Team or Local at a time.");
        return;
      }
      const isTeam = itemsToUpdate[0].pin?.type === "team" || itemsToUpdate[0].folder?.type === "team";
      const pinFilePath = isTeam ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
      if (!fs3.existsSync(pinFilePath)) {
        vscode3.window.showWarningMessage("Could not find pin data file.");
        return;
      }
      const tags = loadTags(workspaceFolder);
      if (!tags.length) {
        vscode3.window.showInformationMessage("No tags defined yet! Use the Tag Manager in the titlebar to add some.");
        return;
      }
      const pickItems = tags.map((tag) => ({
        label: `${colorToEmoji(tag.color)} ${tag.name}`,
        picked: itemsToUpdate.some(
          (sel) => sel.isFolder && sel.folder && Array.isArray(sel.folder.tags) ? sel.folder.tags.includes(tag.id) : sel.pin && Array.isArray(sel.pin.tags) ? sel.pin.tags.includes(tag.id) : false
        ),
        id: tag.id
      }));
      const picked = await vscode3.window.showQuickPick(pickItems, {
        placeHolder: "Assign or remove tags (multi-select)",
        canPickMany: true
      });
      if (!picked) {
        return;
      }
      const selectedTagIds = picked.map((p) => p.id);
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
      for (const sel of itemsToUpdate) {
        if (sel && sel.isFolder && sel.folder && typeof sel.folder.id === "string") {
          folders = folders.map(
            (f) => f.id === sel.folder.id ? { ...f, tags: selectedTagIds } : f
          );
          changed = true;
        } else if (sel && !sel.isFolder && sel.pin && typeof sel.pin.id === "string") {
          pins = pins.map(
            (p) => p.id === sel.pin.id ? { ...p, tags: selectedTagIds } : p
          );
          changed = true;
        }
      }
      if (changed) {
        fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
        pinProvider.refresh?.();
        vscode3.window.showInformationMessage(
          selectedTagIds.length ? `Tags updated for ${itemsToUpdate.length} item${itemsToUpdate.length > 1 ? "s" : ""}!` : `All tags removed from ${itemsToUpdate.length} item${itemsToUpdate.length > 1 ? "s" : ""}.`
        );
      }
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codepin.tagManager", async () => {
      if (!workspaceFolder) {
        vscode3.window.showWarningMessage("No workspace open.");
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
          detail: "",
          id: tag.id
        })));
      }
      const picked = await vscode3.window.showQuickPick(items, {
        placeHolder: "Tag Manager: Add, rename, or delete tags"
      });
      if (!picked) {
        return;
      }
      if (picked.label === "$(add) Add Tag") {
        const TAG_LIMIT = isProUnlocked(context) ? Infinity : FREE_LIMITS.tags;
        if (tags.length >= TAG_LIMIT) {
          showUpgradePrompt(
            `You've reached the free limit of ${FREE_LIMITS.tags} tags. Upgrade to Pro for unlimited tags!`
          );
          return;
        }
        const name = await vscode3.window.showInputBox({
          prompt: "Enter a tag name",
          validateInput: (input) => {
            if (!input.trim()) {
              return "Tag name cannot be empty";
            }
            if (tags.some((tag) => tag.name.toLowerCase() === input.trim().toLowerCase())) {
              return "Tag already exists";
            }
            return null;
          }
        });
        if (!name) {
          return;
        }
        const isPro = isProUnlocked(getExtensionContext());
        const color = await vscode3.window.showQuickPick(
          isPro ? ALL_COLORS : FREE_COLORS,
          { placeHolder: "Choose a tag color" }
        );
        if (!color) {
          return;
        }
        const newTag = {
          id: v4_default(),
          name: name.trim(),
          color: color.value
        };
        const newTags = [...tags, newTag];
        saveTags(workspaceFolder, newTags);
        pinProvider.refresh();
        vscode3.window.showInformationMessage(`\u{1F3F7}\uFE0F Tag "${name.trim()}" added!`);
        await vscode3.commands.executeCommand("codepin.tagManager");
        return;
      }
      const tagToEdit = tags.find((tag) => tag.id === picked.id);
      if (!tagToEdit) {
        return;
      }
      const editPicked = await vscode3.window.showQuickPick([
        { label: "$(edit) Rename Tag" },
        { label: "$(symbol-color) Change Color" },
        { label: "$(trash) Delete Tag" },
        { label: "Cancel" }
      ], { placeHolder: `Edit tag: ${tagToEdit.name}` });
      if (!editPicked || editPicked.label === "Cancel") {
        return;
      }
      if (editPicked.label === "$(edit) Rename Tag") {
        const newName = await vscode3.window.showInputBox({
          prompt: `Rename tag "${tagToEdit.name}"`,
          value: tagToEdit.name,
          validateInput: (input) => {
            if (!input.trim()) {
              return "Tag name cannot be empty";
            }
            if (tags.some((tag) => tag.name.toLowerCase() === input.trim().toLowerCase() && tag.id !== tagToEdit.id)) {
              return "Another tag already has this name";
            }
            return null;
          }
        });
        if (!newName || newName === tagToEdit.name) {
          return;
        }
        tagToEdit.name = newName.trim();
        saveTags(workspaceFolder, tags);
        pinProvider.refresh();
        vscode3.window.showInformationMessage(`Tag renamed to "${tagToEdit.name}".`);
        await vscode3.commands.executeCommand("codepin.tagManager");
        return;
      }
      if (editPicked.label === "$(symbol-color) Change Color") {
        const isPro = isProUnlocked(getExtensionContext());
        const colorOptions = isPro ? ALL_COLORS : FREE_COLORS;
        const newColor = await vscode3.window.showQuickPick(
          colorOptions,
          { placeHolder: "Choose a new tag color" }
        );
        if (!newColor || newColor.value === tagToEdit.color) {
          return;
        }
        tagToEdit.color = newColor.value;
        saveTags(workspaceFolder, tags);
        pinProvider.refresh();
        await vscode3.commands.executeCommand("codepin.tagManager");
        return;
      }
      if (editPicked.label === "$(trash) Delete Tag") {
        const confirm = await vscode3.window.showWarningMessage(
          `Delete tag "${tagToEdit.name}"? This will remove it from all pins/folders.`,
          "Delete"
        );
        if (confirm !== "Delete") {
          return;
        }
        const newTags = tags.filter((tag) => tag.id !== tagToEdit.id);
        removeTagFromAllPinsAndFolders(workspaceFolder, tagToEdit.id);
        saveTags(workspaceFolder, newTags);
        pinProvider.refresh();
        vscode3.window.showInformationMessage(`Tag "${tagToEdit.name}" deleted.`);
        await vscode3.commands.executeCommand("codepin.tagManager");
        return;
      }
    })
  );
  const setColor = (color) => async (item) => {
    let itemsToUpdate = treeView.selection;
    if (!itemsToUpdate.some((sel) => sel.id === item.id)) {
      itemsToUpdate = [item];
    }
    const types = new Set(itemsToUpdate.map((sel) => sel.pin?.type || sel.folder?.type));
    if (types.size > 1) {
      vscode3.window.showWarningMessage("You can only select pins/folders from either Team or Local at a time.");
      return;
    }
    const groupedByFile = {};
    for (const sel of itemsToUpdate) {
      const type = sel.pin?.type || sel.folder?.type;
      const pinFilePath = type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
      if (!groupedByFile[pinFilePath]) {
        groupedByFile[pinFilePath] = { pins: [], folders: [] };
      }
      if (sel.isFolder && sel.folder) {
        groupedByFile[pinFilePath].folders.push(sel.folder);
      } else if (sel.pin) {
        groupedByFile[pinFilePath].pins.push(sel.pin);
      }
    }
    for (const [pinFilePath, { pins: pinsToUpdate, folders: foldersToUpdate }] of Object.entries(groupedByFile)) {
      if (!fs3.existsSync(pinFilePath)) {
        continue;
      }
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
    vscode3.commands.registerCommand("codepin.setColor", async (item) => {
      const isPro = isProUnlocked(getExtensionContext());
      const colorPick = await vscode3.window.showQuickPick(
        isPro ? ALL_COLORS : FREE_COLORS,
        { placeHolder: "Choose a color" }
      );
      if (!colorPick) {
        return;
      }
      if (!isPro && !FREE_COLORS.some((c) => c.value === colorPick.value)) {
        showUpgradePrompt("Unlock more colors with Codepin Pro!");
        return;
      }
      await setColor(colorPick.value)(item);
    })
  );
  const LAST_MODE_KEY = "codepin.lastWorkspaceMode";
  const addFolderCommand = vscode3.commands.registerCommand("codepin.addPinFolder", async () => {
    const folderTitle = await vscode3.window.showInputBox({ prompt: "Folder name" });
    if (!folderTitle) {
      return;
    }
    const isPro = isProUnlocked(getExtensionContext());
    const folderColorPick = await vscode3.window.showQuickPick(
      isPro ? ALL_COLORS : FREE_COLORS,
      { placeHolder: "Choose a folder color" }
    );
    if (!folderColorPick) {
      return;
    }
    const folderColor = folderColorPick.value;
    let isTeam = false;
    if (isPro) {
      const context2 = getExtensionContext();
      const lastUsed = context2.globalState.get(LAST_MODE_KEY) || "Local";
      const options = lastUsed === "Team" ? ["Team", "Local"] : ["Local", "Team"];
      const location = await vscode3.window.showQuickPick(options, {
        placeHolder: "Where do you want to add this pin/folder?"
      });
      if (!location) {
        return;
      }
      await context2.globalState.update(LAST_MODE_KEY, location);
      isTeam = location === "Team";
    }
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
    const FOLDER_LIMIT = isProUnlocked(context) ? Infinity : FREE_LIMITS.folders;
    if (folders.length >= FOLDER_LIMIT) {
      showUpgradePrompt(
        `CodePin Free lets you save up to ${FREE_LIMITS.folders} folders per workspace. Upgrade to Pro for unlimited folders!`
      );
      return;
    }
    const newFolder = {
      id: v4_default(),
      title: folderTitle,
      color: folderColor,
      order: folders.length,
      type: isTeam ? "team" : "local"
    };
    folders.push(newFolder);
    reindexFolderOrders(folders);
    fs3.writeFileSync(pinFilePath, JSON.stringify({ pins, folders }, null, 2), "utf8");
    vscode3.window.showInformationMessage(`\u{1F4C1} Folder "${folderTitle}" added!`);
    pinProvider.refresh();
  });
  const addPinCommand = vscode3.commands.registerCommand("codepin.addPin", async () => {
    const editor = vscode3.window.activeTextEditor;
    if (!editor) {
      vscode3.window.showWarningMessage("No active editor found.");
      return;
    }
    const selection = editor.selection;
    const filePath = editor.document.uri.fsPath;
    let line;
    if (selection.start.line !== selection.end.line && !isProUnlocked(context)) {
      showUpgradePrompt("Multi-line pinning is a Pro feature! Upgrade to unlock it.");
      return;
    }
    if (selection.start.line === selection.end.line) {
      line = selection.start.line;
    } else {
      line = [selection.start.line, selection.end.line];
    }
    const pinTitle = await vscode3.window.showInputBox({ prompt: "Give your pin a title" });
    if (!pinTitle) {
      return;
    }
    const isPro = isProUnlocked(getExtensionContext());
    const pinColorPick = await vscode3.window.showQuickPick(
      isPro ? ALL_COLORS : FREE_COLORS,
      { placeHolder: "Choose a pin color" }
    );
    if (!pinColorPick) {
      return;
    }
    const pinColor = pinColorPick.value;
    let isTeam = false;
    if (isPro) {
      const context2 = getExtensionContext();
      const lastUsed = context2.globalState.get(LAST_MODE_KEY) || "Local";
      const options = lastUsed === "Team" ? ["Team", "Local"] : ["Local", "Team"];
      const location = await vscode3.window.showQuickPick(options, {
        placeHolder: "Where do you want to add this pin/folder?"
      });
      if (!location) {
        return;
      }
      await context2.globalState.update(LAST_MODE_KEY, location);
      isTeam = location === "Team";
    }
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
    const PIN_LIMIT = isProUnlocked(context) ? Infinity : FREE_LIMITS.pins;
    if (pins.length >= PIN_LIMIT) {
      showUpgradePrompt(
        `Codepin Free lets you save up to ${FREE_LIMITS.pins} pins per workspace. Upgrade to Pro for unlimited pins!`
      );
      return;
    }
    const parentFolderId = null;
    const siblingPins = pins.filter((p) => (p.parentFolderId ?? null) === parentFolderId);
    const newPin = {
      id: v4_default(),
      file: path3.relative(workspaceFolder, filePath),
      line,
      title: pinTitle,
      color: pinColor,
      type: isTeam ? "team" : "local",
      parentFolderId,
      order: siblingPins.length
    };
    pins.push(newPin);
    reindexOrders(pins, parentFolderId);
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
    vscode3.window.showInformationMessage(`\u{1F4CC} Pinned "${pinTitle}" at ${lineLabel}`);
    pinProvider.refresh();
  });
  const openPinCommand = vscode3.commands.registerCommand("codepin.openPin", (item) => {
    const pin = item.pin ?? item;
    if (!pin || !pin.file) {
      return;
    }
    const filePath = path3.join(workspaceFolder, pin.file);
    const uri = vscode3.Uri.file(filePath);
    vscode3.workspace.openTextDocument(uri).then((doc) => {
      vscode3.window.showTextDocument(doc).then((editor) => {
        let selection;
        if (typeof pin.line === "number") {
          const pos = new vscode3.Position(pin.line, 0);
          selection = new vscode3.Selection(pos, pos);
        } else if (Array.isArray(pin.line)) {
          const startLine = Math.min(pin.line[0], pin.line[1]);
          const endLine = Math.max(pin.line[0], pin.line[1]);
          const start = new vscode3.Position(startLine, 0);
          const end = new vscode3.Position(endLine, doc.lineAt(endLine).text.length);
          selection = new vscode3.Selection(start, end);
        }
        if (selection) {
          editor.selection = selection;
          editor.revealRange(selection, vscode3.TextEditorRevealType.InCenter);
        }
      });
    });
  });
  const deleteCommand = vscode3.commands.registerCommand("codepin.delete", async (item) => {
    let itemsToDelete = treeView.selection;
    if (!itemsToDelete.some((sel) => sel.id === item.id)) {
      itemsToDelete = [item];
    }
    const types = new Set(itemsToDelete.map((sel) => sel.pin?.type || sel.folder?.type));
    if (types.size > 1) {
      vscode3.window.showWarningMessage("You can only select pins/folders from either Team or Local at a time.");
      return;
    }
    const groupedByFile = {};
    for (const sel of itemsToDelete) {
      const type = sel.pin?.type || sel.folder?.type;
      const pinFilePath = type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
      if (!groupedByFile[pinFilePath]) {
        groupedByFile[pinFilePath] = { pins: [], folders: [] };
      }
      if (sel.isFolder && sel.folder) {
        groupedByFile[pinFilePath].folders.push(sel.folder);
      } else if (sel.pin) {
        groupedByFile[pinFilePath].pins.push(sel.pin);
      }
    }
    let totalPins = 0;
    let totalFolders = 0;
    for (const [pinFilePath, { pins: pinsToDelete, folders: foldersToDelete }] of Object.entries(groupedByFile)) {
      if (!fs3.existsSync(pinFilePath)) {
        continue;
      }
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
        const result = await vscode3.window.showInformationMessage(
          "One or more folders you\u2019re deleting still contain pins. These pins will be moved to root. Continue?",
          "Yes",
          "No"
        );
        if (result !== "Yes") {
          return;
        }
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
    if (totalPins > 0) {
      parts.push(`${totalPins} pin${totalPins > 1 ? "s" : ""}`);
    }
    if (totalFolders > 0) {
      parts.push(`${totalFolders} folder${totalFolders > 1 ? "s" : ""}`);
    }
    const msg = `Deleted ${parts.join(" and ")}.`;
    const undoBtn = await vscode3.window.showInformationMessage(`${msg} Undo?`, "Undo");
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
      vscode3.window.showInformationMessage(`Restored ${parts.join(" and ")}.`);
      lastDeleted = null;
    }
  });
  const renameCommand = vscode3.commands.registerCommand("codepin.rename", async (item) => {
    const isTeam = item.pin?.type === "team" || item.folder?.type === "team";
    const pinFilePath = isTeam ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    if (!fs3.existsSync(pinFilePath)) {
      return;
    }
    const newTitle = await vscode3.window.showInputBox({
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
  const addNoteCommand = vscode3.commands.registerCommand("codepin.addNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    if (!fs3.existsSync(filePath)) {
      return;
    }
    const note = await vscode3.window.showInputBox({ prompt: "Add a note" });
    if (note === null) {
      return;
    }
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
  const editNoteCommand = vscode3.commands.registerCommand("codepin.editNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    if (!fs3.existsSync(filePath)) {
      return;
    }
    const currentNote = isFolder ? item.folder.note : item.pin.note;
    const note = await vscode3.window.showInputBox({
      prompt: "Edit note",
      value: currentNote || ""
    });
    if (note === null) {
      return;
    }
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
  const removeNoteCommand = vscode3.commands.registerCommand("codepin.removeNote", async (item) => {
    const isFolder = item.isFolder && item.folder;
    const filePath = isFolder ? item.folder.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json") : item.pin.type === "team" ? path3.join(workspaceFolder, ".codepin.team.json") : path3.join(workspaceFolder, ".codepin.local.json");
    if (!fs3.existsSync(filePath)) {
      return;
    }
    const confirm = await vscode3.window.showInformationMessage(
      "Remove note from this item?",
      "Yes",
      "Cancel"
    );
    if (confirm !== "Yes") {
      return;
    }
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
    addFolderCommand,
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
function reindexOrders(pins, parentFolderId) {
  const siblings = pins.filter((p) => (p.parentFolderId ?? null) === parentFolderId);
  siblings.sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : 0;
    const orderB = typeof b.order === "number" ? b.order : 0;
    return orderA - orderB;
  });
  siblings.forEach((p, idx) => p.order = idx);
}
function reindexFolderOrders(folders) {
  folders.sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : 0;
    const orderB = typeof b.order === "number" ? b.order : 0;
    return orderA - orderB;
  });
  folders.forEach((f, idx) => f.order = idx);
}
function removeTagFromAllPinsAndFolders(workspaceFolder, tagId) {
  function updateFile(pinFilePath) {
    if (!fs3.existsSync(pinFilePath)) {
      return;
    }
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
  const quickInput = vscode3.window.createQuickPick();
  quickInput.placeholder = "Search pins and folders by name or note...";
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
  FREE_LIMITS,
  activate,
  colorToEmoji,
  deactivate,
  reindexFolderOrders
});
//# sourceMappingURL=extension.js.map
