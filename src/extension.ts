// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TEMPLATE } from './view/template';
import { ReferenceItem, ReferenceGroup } from './types/referenct';
import { ReferenceDataManager } from './ReferenceDataManager';
import { FileRefTagsViewProvider } from './FileRefTagsViewProvider';
import { CatCodiconsPanel } from './CatCodiconsPanel';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "file-ref-tags" is now active!');

	// 初始化数据管理器
	const dataManager = new ReferenceDataManager(context);

	// 创建视图提供器
	const webviewViewProvider = new FileRefTagsViewProvider(context.extensionUri, dataManager);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('file-ref-tags.list-view', webviewViewProvider)
	);

	// 注册处理URI的逻辑
	const handleUri = async (uri: vscode.Uri) => {
		try {
			// 解析URL查询参数
			const query = new URLSearchParams(uri.query);
			const filePath = query.get('filePath');
			const snippet = query.get('snippet');

			// 确保至少有一个参数
			if (!filePath && !snippet) {
				vscode.window.showErrorMessage('URL缺少必要参数：filePath或snippet');
				return;
			}

			// 解码参数
			const decodedFilePath = filePath ?? undefined;
			const decodedSnippet = snippet ?? undefined;

			// 根据参数组合决定跳转模式
			if (decodedFilePath && decodedSnippet) {
				// 模式1：file-snippet，跳转到文件并搜索代码片段
				await jumpToFileAndSnippet(decodedFilePath, decodedSnippet);
			} else if (decodedFilePath) {
				// 模式2：file，直接跳转到文件
				await jumpToFile(decodedFilePath);
			} else if (decodedSnippet) {
				// 模式3：global-snippet，全局搜索代码片段
				await jumpToGlobalSnippet(decodedSnippet);
			}
		} catch (error) {
			console.error('Failed to handle URI:', error);
			vscode.window.showErrorMessage(`处理URL失败：${error instanceof Error ? error.message : String(error)}`);
		}
	};

	// 跳转到文件
	const jumpToFile = async (filePath: string) => {
		try {
			let fileUri: vscode.Uri;

			// 检查是否为绝对路径
			if (path.isAbsolute(filePath)) {
				fileUri = vscode.Uri.file(filePath);
			} else {
				// 相对路径或仅文件名，在工作区中查找
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (!workspaceFolders || workspaceFolders.length === 0) {
					vscode.window.showErrorMessage('未打开工作区，无法使用相对路径或仅文件名');
					return;
				}

				// 查找匹配的文件
				const matches: vscode.Uri[] = [];
				for (const folder of workspaceFolders) {
					// 直接匹配文件名
					const files = await vscode.workspace.findFiles(`**/${filePath.replace(/\\/g, '/').replace(/\$/g, '\\$')}`, '**/node_modules/**');
					matches.push(...files);
				}

				if (matches.length === 0) {
					vscode.window.showErrorMessage(`未找到文件：${filePath}`);
					return;
				} else if (matches.length > 1) {
					vscode.window.showWarningMessage(`找到多个匹配文件，将打开第一个：${filePath}`);
				}

				fileUri = matches[0];
			}

			await vscode.window.showTextDocument(fileUri);
		} catch (error) {
			console.error('Failed to jump to file:', error);
			vscode.window.showErrorMessage(`跳转到文件失败：${error instanceof Error ? error.message : String(error)}`);
		}
	};

	// 跳转到文件并搜索代码片段
	const jumpToFileAndSnippet = async (filePath: string, snippet: string) => {
		try {
			let fileUri: vscode.Uri;

			// 检查是否为绝对路径
			if (path.isAbsolute(filePath)) {
				fileUri = vscode.Uri.file(filePath);
			} else {
				// 相对路径或仅文件名，在工作区中查找
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (!workspaceFolders || workspaceFolders.length === 0) {
					vscode.window.showErrorMessage('未打开工作区，无法使用相对路径或仅文件名');
					return;
				}

				// 查找匹配的文件，并结合代码片段筛选
				const matches: vscode.Uri[] = [];
				for (const folder of workspaceFolders) {
					// 直接匹配文件名
					const files = await vscode.workspace.findFiles(`**/${filePath.replace(/\\/g, '/').replace(/\$/g, '\\$')}`, '**/node_modules/**');
					matches.push(...files);
				}

				if (matches.length === 0) {
					vscode.window.showErrorMessage(`未找到文件：${filePath}`);
					return;
				}

				// 如果有多个匹配文件，结合代码片段筛选
				let targetFileUri: vscode.Uri | undefined;
				if (matches.length === 1) {
					targetFileUri = matches[0];
				} else {
					vscode.window.showInformationMessage(`找到${matches.length}个匹配文件，正在结合代码片段筛选...`);

					// 遍历每个匹配文件，查找包含代码片段的文件
					for (const match of matches) {
						try {
							const doc = await vscode.workspace.openTextDocument(match);
							const text = doc.getText();
							if (text.includes(snippet)) {
								targetFileUri = match;
								break;
							}
						} catch (error) {
							console.error(`无法打开文件：${match.fsPath}`, error);
							continue;
						}
					}

					if (!targetFileUri) {
						vscode.window.showErrorMessage(`找到${matches.length}个匹配文件，但没有包含指定代码片段的文件：${filePath}`);
						return;
					}

					vscode.window.showInformationMessage(`已筛选出包含代码片段的文件：${path.basename(targetFileUri.fsPath)}`);
				}

				fileUri = targetFileUri!;
			}

			const textEditor = await vscode.window.showTextDocument(fileUri);
			const doc = textEditor.document;
			// 搜索代码片段
			const text = doc.getText();
			const index = text.indexOf(snippet);
			if (index !== -1) {
				const startPosition = doc.positionAt(index);
				const endPosition = doc.positionAt(index + snippet.length);
				const range = new vscode.Range(startPosition, endPosition);
				await vscode.window.showTextDocument(fileUri, { selection: range });
				// 确保选中的内容可见
				await textEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
			} else {
				vscode.window.showWarningMessage(`文件中未找到指定代码片段：${fileUri.fsPath}`);
			}
		} catch (error) {
			console.error('Failed to jump to file and snippet:', error);
			vscode.window.showErrorMessage(`跳转到文件并搜索代码片段失败：${error instanceof Error ? error.message : String(error)}`);
		}
	};

	// 全局搜索并跳转到代码片段
	const jumpToGlobalSnippet = async (snippet: string) => {
		if (!snippet) {
			vscode.window.showErrorMessage('代码片段不能为空');
			return;
		}
		
		try {
			// 先获取当前工作区的所有文件
			const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 10000);
			console.log('搜索文件数量:', files.length);

			let matchCount = 0;
			let matchFile: vscode.Uri | undefined;
			let matchStartPosition: vscode.Position | undefined;
			let matchEndPosition: vscode.Position | undefined;

			// 遍历文件，查找包含代码片段的文件
			for (const file of files) {
				try {
					const doc = await vscode.workspace.openTextDocument(file);
					const text = doc.getText();
					const index = text.indexOf(snippet);
					if (index !== -1) {
						matchCount++;
						matchFile = file;
						matchStartPosition = doc.positionAt(index);
						matchEndPosition = doc.positionAt(index + snippet.length);
						// 如果超过1个匹配，就可以提前结束
						if (matchCount > 1) {
							break;
						}
					}
				} catch (error) {
					// 忽略无法打开的文件
					console.error('无法打开文件:', file.fsPath, error);
					continue;
				}
			}

			console.log('匹配数量:', matchCount);

			if (matchCount === 1 && matchFile && matchStartPosition && matchEndPosition) {
				const textEditor = await vscode.window.showTextDocument(matchFile);
				const range = new vscode.Range(matchStartPosition, matchEndPosition);
				await vscode.window.showTextDocument(matchFile, { selection: range });
				// 确保选中的内容可见
				await textEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
			} else if (matchCount === 0) {
				vscode.window.showWarningMessage('未找到匹配的代码片段');
			} else {
				vscode.window.showWarningMessage('代码片段已不是全局唯一');
			}
		} catch (error) {
			console.error('Global search failed:', error);
			vscode.window.showErrorMessage(`全局搜索失败：${error instanceof Error ? error.message : String(error)}`);
		}
	};

	// 监听URI激活事件
	context.subscriptions.push(vscode.window.registerUriHandler({
		handleUri: handleUri
	}));

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('file-ref-tags.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from file-ref-tags!');
	});

	context.subscriptions.push(disposable);

	// 注册添加当前文件到面板的命令
	const addCurrentFileDisposable = vscode.commands.registerCommand('file-ref-tags.addCurrentFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('没有打开的文件');
			return;
		}

		const document = editor.document;
		const filePath = document.uri.fsPath;
		const fileName = path.basename(filePath);

		// 创建引用项
		dataManager.addReference({
			type: 'file',
			title: fileName,
			filePath: filePath
		});

		// 通知webview更新
		webviewViewProvider.notifyUpdate();
		vscode.window.showInformationMessage('已添加当前文件到面板');
	});

	context.subscriptions.push(addCurrentFileDisposable);

	// 注册添加当前文件+选中片段到面板的命令
	const addFileAndSnippetDisposable = vscode.commands.registerCommand('file-ref-tags.addFileAndSnippet', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('没有打开的文件');
			return;
		}

		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showErrorMessage('请先选中代码片段');
			return;
		}

		const document = editor.document;
		const filePath = document.uri.fsPath;
		const snippet = document.getText(selection);

		// 截取代码片段作为标题（最多50个字符）
		const snippetPreview = snippet.substring(0, 50) + (snippet.length > 50 ? '...' : '');
		const fileName = path.basename(filePath);
		const title = `${fileName}: ${snippetPreview}`;

		// 创建引用项
		dataManager.addReference({
			type: 'file-snippet',
			title: title,
			filePath: filePath,
			snippet: snippet
		});

		// 通知webview更新
		webviewViewProvider.notifyUpdate();
		vscode.window.showInformationMessage('已添加当前文件+选中片段到面板');
	});

	context.subscriptions.push(addFileAndSnippetDisposable);

	// 注册添加当前选中的全局唯一片段到面板的命令
	const addGlobalUniqueSnippetDisposable = vscode.commands.registerCommand('file-ref-tags.addGlobalUniqueSnippet', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('没有打开的文件');
			return;
		}

		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showErrorMessage('请先选中代码片段');
			return;
		}

		const document = editor.document;
		const filePath = document.uri.fsPath;
		const snippet = editor.document.getText(selection);

		// 截取代码片段作为标题（最多50个字符）
		const title = snippet.substring(0, 50) + (snippet.length > 50 ? '...' : '');

		// 直接创建引用项，不进行全局搜索，但记录当前文件路径
		const newReference = dataManager.addReference({
			type: 'global-snippet',
			title: title,
			snippet: snippet,
			targetFilePath: filePath  // 记录当前文件路径
		});

		// 通知webview更新
		webviewViewProvider.notifyUpdate();
		vscode.window.showInformationMessage('已添加当前选中的全局唯一片段到面板');
	});

	context.subscriptions.push(addGlobalUniqueSnippetDisposable);

	// 注册添加用户注释到面板的命令
	const addCommentDisposable = vscode.commands.registerCommand('file-ref-tags.addComment', async () => {
		// 显示输入框，让用户输入注释
		const comment = await vscode.window.showInputBox({
			prompt: '请输入注释内容',
			placeHolder: '例如：重要的API函数',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return '注释内容不能为空';
				}
				return null;
			}
		});

		if (comment) {
			// 创建引用项
			dataManager.addReference({
				type: 'comment',
				title: comment.trim()
			});

			// 通知webview更新
			webviewViewProvider.notifyUpdate();
			vscode.window.showInformationMessage('已添加用户注释到面板');
		}
	});

	context.subscriptions.push(addCommentDisposable);

	// 注册添加分组命令
	const addGroupDisposable = vscode.commands.registerCommand('file-ref-tags.addGroup', async () => {
		// 显示输入框，让用户输入分组名称
		const groupName = await vscode.window.showInputBox({
			prompt: '请输入分组名称',
			placeHolder: '例如：API相关',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return '分组名称不能为空';
				}
				return null;
			}
		});

		if (groupName) {
			// 创建分组
			dataManager.addGroup(groupName.trim());
			// 通知webview更新
			webviewViewProvider.notifyUpdate();
			vscode.window.showInformationMessage('已添加新分组');
		}
	});

	context.subscriptions.push(addGroupDisposable);

	// 辅助函数：生成 vscode:// 链接
	const generateVscodeLink = (filePath?: string, snippet?: string): string => {
		const scheme = vscode.env.uriScheme || 'vscode';
		const baseUrl = `${scheme}://lirentech.file-ref-tags`;
		const params = new URLSearchParams();

		if (filePath) {
			params.append('filePath', filePath);
		}
		if (snippet) {
			params.append('snippet', snippet);
		}

		const queryString = params.toString();
		return queryString ? `${baseUrl}?${queryString}` : baseUrl;
	};

	// 辅助函数：获取相对于工作区的路径
	const getWorkspaceRelativePath = (filePath: string): string | undefined => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return undefined;
		}

		// 查找匹配的工作区文件夹
		for (const folder of workspaceFolders) {
			const folderPath = folder.uri.fsPath;
			if (filePath.startsWith(folderPath)) {
				// 获取相对于工作区的路径
				const relativePath = path.relative(folderPath, filePath);
				return relativePath;
			}
		}

		return undefined;
	};

	// 辅助函数：检查代码片段在当前文件中的唯一性
	const checkSnippetUniquenessInFile = (document: vscode.TextDocument, snippet: string): { isUnique: boolean; count: number } => {
		const text = document.getText();
		// 使用 indexOf 查找所有匹配的片段（不重叠）
		let count = 0;
		let index = 0;
		while (index !== -1) {
			index = text.indexOf(snippet, index);
			if (index !== -1) {
				count++;
				index += snippet.length; // 移动到下一个可能的位置（不重叠）
			}
		}
		return {
			isUnique: count === 1,
			count: count
		};
	};

	// 注册复制链接（仅代码片段）的命令
	const copyLinkSnippetOnlyDisposable = vscode.commands.registerCommand('file-ref-tags.copyLinkSnippetOnly', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('没有打开的文件');
			return;
		}

		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showErrorMessage('请先选中代码片段');
			return;
		}

		const document = editor.document;
		const snippet = document.getText(selection);
		
		// 检查代码片段在当前文件中的唯一性
		const uniqueness = checkSnippetUniquenessInFile(document, snippet);
		if (!uniqueness.isUnique) {
			vscode.window.showWarningMessage(`警告：当前文件中存在 ${uniqueness.count} 个相同的代码片段，链接可能无法准确定位`);
		}

		const link = generateVscodeLink(undefined, snippet);

		await vscode.env.clipboard.writeText(link);
		vscode.window.showInformationMessage('链接已复制到剪贴板');
	});

	context.subscriptions.push(copyLinkSnippetOnlyDisposable);

	// 注册复制链接（仅文件名）的命令
	const copyLinkFileNameOnlyDisposable = vscode.commands.registerCommand('file-ref-tags.copyLinkFileNameOnly', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('没有打开的文件');
			return;
		}

		const document = editor.document;
		const filePath = document.uri.fsPath;
		const fileName = path.basename(filePath);
		const link = generateVscodeLink(fileName, undefined);

		await vscode.env.clipboard.writeText(link);
		vscode.window.showInformationMessage('链接已复制到剪贴板');
	});

	context.subscriptions.push(copyLinkFileNameOnlyDisposable);

	// 注册复制链接（文件名+代码片段）的命令
	const copyLinkFileNameAndSnippetDisposable = vscode.commands.registerCommand('file-ref-tags.copyLinkFileNameAndSnippet', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('没有打开的文件');
			return;
		}

		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showErrorMessage('请先选中代码片段');
			return;
		}

		const document = editor.document;
		const filePath = document.uri.fsPath;
		const fileName = path.basename(filePath);
		const snippet = document.getText(selection);

		// 检查代码片段在当前文件中的唯一性
		const uniqueness = checkSnippetUniquenessInFile(document, snippet);
		if (!uniqueness.isUnique) {
			vscode.window.showWarningMessage(`警告：当前文件中存在 ${uniqueness.count} 个相同的代码片段，链接可能无法准确定位`);
		}

		const link = generateVscodeLink(fileName, snippet);

		await vscode.env.clipboard.writeText(link);
		vscode.window.showInformationMessage('链接已复制到剪贴板');
	});

	context.subscriptions.push(copyLinkFileNameAndSnippetDisposable);

	// 注册复制链接（父级文件夹+文件名+代码片段）的命令
	const copyLinkParentDirAndSnippetDisposable = vscode.commands.registerCommand('file-ref-tags.copyLinkParentDirAndSnippet', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('没有打开的文件');
			return;
		}

		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showErrorMessage('请先选中代码片段');
			return;
		}

		const document = editor.document;
		const filePath = document.uri.fsPath;
		const dirName = path.basename(path.dirname(filePath));
		const fileName = path.basename(filePath);
		const parentDirAndFileName = `${dirName}/${fileName}`;
		const snippet = document.getText(selection);

		// 检查代码片段在当前文件中的唯一性
		const uniqueness = checkSnippetUniquenessInFile(document, snippet);
		if (!uniqueness.isUnique) {
			vscode.window.showWarningMessage(`警告：当前文件中存在 ${uniqueness.count} 个相同的代码片段，链接可能无法准确定位`);
		}

		const link = generateVscodeLink(parentDirAndFileName, snippet);

		await vscode.env.clipboard.writeText(link);
		vscode.window.showInformationMessage('链接已复制到剪贴板');
	});

	context.subscriptions.push(copyLinkParentDirAndSnippetDisposable);

	// 注册复制链接（项目级路径+代码片段）的命令
	const copyLinkWorkspacePathAndSnippetDisposable = vscode.commands.registerCommand('file-ref-tags.copyLinkWorkspacePathAndSnippet', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('没有打开的文件');
			return;
		}

		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showErrorMessage('请先选中代码片段');
			return;
		}

		const document = editor.document;
		const filePath = document.uri.fsPath;
		const workspaceRelativePath = getWorkspaceRelativePath(filePath);

		if (!workspaceRelativePath) {
			vscode.window.showErrorMessage('无法获取项目级路径，请确保文件在工作区内');
			return;
		}

		const snippet = document.getText(selection);

		// 检查代码片段在当前文件中的唯一性
		const uniqueness = checkSnippetUniquenessInFile(document, snippet);
		if (!uniqueness.isUnique) {
			vscode.window.showWarningMessage(`警告：当前文件中存在 ${uniqueness.count} 个相同的代码片段，链接可能无法准确定位`);
		}

		// 将路径分隔符统一为正斜杠（URL友好）
		const normalizedPath = workspaceRelativePath.replace(/\\/g, '/');
		const link = generateVscodeLink(normalizedPath, snippet);

		await vscode.env.clipboard.writeText(link);
		vscode.window.showInformationMessage('链接已复制到剪贴板');
	});

	context.subscriptions.push(copyLinkWorkspacePathAndSnippetDisposable);

 	context.subscriptions.push(
		vscode.commands.registerCommand('file-ref-tags.catCodiconsShow', () => {
			CatCodiconsPanel.show(context.extensionUri);
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
