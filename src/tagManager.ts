import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PinProvider } from './pinProvider';

const TAGS_FILE = '.codepin.tags.json';

export interface CodepinTag {
  id: string;
  name: string;
  color: string;
}

export interface TagQuickPickItem extends vscode.QuickPickItem {
  id: string;
}

export function loadTags(workspaceRoot: string): CodepinTag[] {
  const tagsPath = path.join(workspaceRoot, TAGS_FILE);
  if (!fs.existsSync(tagsPath)) return [];
  try {
    const content = fs.readFileSync(tagsPath, 'utf8');
    return JSON.parse(content) as CodepinTag[];
  } catch {
    return [];
  }
}

export function saveTags(workspaceRoot: string, tags: CodepinTag[]) {
  const tagsPath = path.join(workspaceRoot, TAGS_FILE);
  fs.writeFileSync(tagsPath, JSON.stringify(tags, null, 2), 'utf8');
}
