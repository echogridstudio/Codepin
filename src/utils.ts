// utility functions

import * as vscode from "vscode";

export function isProUnlocked(context: vscode.ExtensionContext): boolean {
    // Check globalState first, fallback to config (for settings-based unlock)
    return context.globalState.get<boolean>('codepinProUnlocked', false)
        || !!vscode.workspace.getConfiguration("codepin").get<string>("proLicenseKey");
}


export function showUpgradePrompt(message: string) {
    vscode.window.showInformationMessage(
        message,
        "Upgrade to Pro"
    ).then(selection => {
        if (selection === "Upgrade to Pro") {
            vscode.env.openExternal(vscode.Uri.parse("https://echogrid.gumroad.com/l/codepinprolicensekey")); 
        }
    });
}

