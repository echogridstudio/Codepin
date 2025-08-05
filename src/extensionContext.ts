// Extensioncontext 

import * as vscode from 'vscode';

let extensionContext: vscode.ExtensionContext;

export function setExtensionContext(ctx: vscode.ExtensionContext) {
    extensionContext = ctx;
}

export function getExtensionContext(): vscode.ExtensionContext {
    return extensionContext;
}
