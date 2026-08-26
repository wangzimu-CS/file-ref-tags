// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TEMPLATE } from './view/template';
import { ReferenceItem, ReferenceGroup } from './types/referenct';

import { MobxConsoleLogger } from "@knuddels/mobx-logger";
import * as mobx from "mobx";

import { rootHandleUri } from './uriDispatcher'

import { activateFRT } from "./extensionFRT";
import { Extension } from "./drawio/Extension";
import * as inlineEditor from "./drawio/inline-editor/extension";

if (process.env.DEV === "1") {
	// 调试时开启
	new MobxConsoleLogger(mobx);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "file-ref-tags" is now active!');

	//创建FRT
    activateFRT(context)

	context.subscriptions.push(new Extension(context));

	inlineEditor.activate(context);

	// Return extendMarkdownIt so VS Code's markdown preview can find it.

	// ✅ 全局仅此一处！！
    const uriDisposable = vscode.window.registerUriHandler({
        handleUri: rootHandleUri
    });
    context.subscriptions.push(uriDisposable);

	return { extendMarkdownIt };
}

// This method is called when your extension is deactivated
export function deactivate() { }

export function extendMarkdownIt(md: any) {
	return inlineEditor.extendMarkdownIt(md);
}
