import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TEMPLATE } from './view/template';
import { ReferenceItem, ReferenceGroup } from './types/referenct';
import { ReferenceDataManager } from './ReferenceDataManager';

// Webview视图提供器
export class FileRefTagsViewProvider implements vscode.WebviewViewProvider {
  private _webviewView?: vscode.WebviewView;
  private _dataManager: ReferenceDataManager;

  constructor(private readonly _extensionUri: vscode.Uri, dataManager: ReferenceDataManager) {
    this._dataManager = dataManager;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._webviewView = webviewView;

    // Set the webview options
    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    // Set the webview HTML content
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'getReferences':
            this._sendReferences();
            return;
          case 'updateOrder':
            this._dataManager.updateOrder(message.order);
            this._sendReferences();
            return;
          case 'updateGroupOrder':
            this._dataManager.updateGroupOrder(message.order);
            this._sendReferences();
            return;
          case 'deleteReference':
            this._dataManager.deleteReference(message.id);
            this._sendReferences();
            return;
          case 'jumpToReference':
            this._jumpToReference(message.id);
            return;
          case 'showStorageLocation':
            this._showStorageLocation();
            return;
          case 'updateReferenceTitle':
            this._dataManager.updateReferenceTitle(message.id, message.title);
            this._sendReferences();
            return;
          case 'addGroup':
            this._addGroup(message.name);
            return;
          case 'deleteGroup':
            this._dataManager.deleteGroup(message.id);
            this._sendReferences();
            return;
          case 'updateReferenceGroup':
            this._dataManager.updateReferenceGroup(message.id, message.groupId);
            this._sendReferences();
            return;
        }
      },
      undefined,
      // No need for a disposal token here since webviewView is already tracked
    );

    // Handle view state changes
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        // Update the view when it becomes visible
        this._sendReferences();
      }
    });

    // 监听主题变化
    // 注意：VS Code的CSS变量会自动更新，但为了确保兼容性，我们在主题变化时重新设置HTML
    const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      if (this._webviewView?.visible) {
        // 重新设置HTML内容以应用新的主题变量
        // CSS变量会自动更新，但重新设置HTML可以确保所有样式都正确应用
        this._webviewView.webview.html = this._getHtmlForWebview(this._webviewView.webview);
        // 重新发送引用数据以恢复状态
        setTimeout(() => {
          this._sendReferences();
        }, 50);
      }
    });

    // 将主题变化监听器添加到webview的dispose中
    webviewView.onDidDispose(() => {
      themeChangeDisposable.dispose();
    });
  }

  // 发送引用数据到webview
  private _sendReferences(): void {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: 'updateReferences',
        references: this._dataManager.getReferences(),
        groups: this._dataManager.getGroups()
      });
    }
  }

  // 添加标签组
  private _addGroup(name: string): void {
    this._dataManager.addGroup(name);
    this._sendReferences();
  }

  // 跳转到引用位置
  private async _jumpToReference(id: string): Promise<void> {
    const references = this._dataManager.getReferences();
    const reference = references.find(r => r.id === id);
    if (!reference) {
      return;
    }

    try {
      switch (reference.type) {
        case 'file':
          // 直接跳转到文件
          if (reference.filePath) {
            const uri = vscode.Uri.file(reference.filePath);
            await vscode.window.showTextDocument(uri);
          }
          break;
        case 'file-snippet':
          // 跳转到文件并搜索代码片段
          if (reference.filePath && reference.snippet) {
            const uri = vscode.Uri.file(reference.filePath);
            const textEditor = await vscode.window.showTextDocument(uri);
            const doc = textEditor.document;
            // 搜索代码片段
            const text = doc.getText();
            const index = text.indexOf(reference.snippet);
            if (index !== -1) {
              const startPosition = doc.positionAt(index);
              const endPosition = doc.positionAt(index + reference.snippet.length);
              const range = new vscode.Range(startPosition, endPosition);
              await vscode.window.showTextDocument(uri, { selection: range });
              // 确保选中的内容可见
              await textEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            } else {
              vscode.window.showWarningMessage('代码片段已不存在于文件中');
            }
          }
          break;
        case 'global-snippet':
          // 全局搜索代码片段
          if (reference.snippet) {
            // 尝试使用层级搜索算法
            await this._jumpToGlobalSnippetWithHierarchy(reference);
          }
          break;
        case 'comment':
          // 注释项，无跳转功能
          break;
      }
    } catch (error) {
      console.error('Failed to jump to reference:', error);
      vscode.window.showErrorMessage('跳转到引用失败');
    }
  }

  // 通知webview更新引用数据
  notifyUpdate(): void {
    this._sendReferences();
  }

  // 显示存储位置
  private async _showStorageLocation(): Promise<void> {
    try {
      if ('getStoragePath' in this._dataManager) {
        const storagePath = (this._dataManager as any).getStoragePath();
        const uri = vscode.Uri.file(storagePath);

        // 显示文件在资源管理器中
        await vscode.commands.executeCommand('revealFileInOS', uri);
        // 同时在编辑器中打开文件
        await vscode.window.showTextDocument(uri);
      } else {
        vscode.window.showErrorMessage('无法获取存储路径');
      }
    } catch (error) {
      console.error('显示存储位置失败:', error);
      vscode.window.showErrorMessage('显示存储位置失败，可能需要先有引用数据才行');
    }
  }

  // 生成webview HTML
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return TEMPLATE;
  }

  // 使用层级搜索跳转到全局代码片段
  private async _jumpToGlobalSnippetWithHierarchy(reference: ReferenceItem): Promise<void> {
    if (!reference.snippet) {
      return;
    }

    const snippet = reference.snippet;
    
    // 首先尝试在记录的文件路径中查找
    if (reference.targetFilePath) {
      const foundFilePath = await this._searchAndJumpInFile(reference.targetFilePath, snippet);
      if (foundFilePath) {
        return;
      }
    }

    // 如果在记录的文件中没有找到，则使用层级搜索
    if (reference.targetFilePath) {
      const foundInHierarchy = await this._hierarchicalSearchAndJump(reference.targetFilePath, snippet, reference.id);
      if (foundInHierarchy) {
        return;
      }
    }

    // 如果层级搜索没有找到，则进行全局搜索
    await this._globalSearchAndJump(reference);
  }

  // 在指定文件中搜索代码片段并跳转
  private async _searchAndJumpInFile(filePath: string, snippet: string): Promise<string | null> {
    if (!snippet) {
      return null;
    }
    
    try {
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const text = doc.getText();
      const index = text.indexOf(snippet);
      
      if (index !== -1) {
        const textEditor = await vscode.window.showTextDocument(uri);
        const startPosition = doc.positionAt(index);
        const endPosition = doc.positionAt(index + snippet.length);
        const range = new vscode.Range(startPosition, endPosition);
        
        await vscode.window.showTextDocument(uri, { selection: range });
        // 确保选中的内容可见
        await textEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        
        return filePath;  // 返回找到的文件路径
      }
    } catch (error) {
      console.error('无法在文件中搜索代码片段:', filePath, error);
    }
    
    return null;
  }
  
  // 层级搜索并在找到后跳转
  private async _hierarchicalSearchAndJump(originalFilePath: string, snippet: string, referenceId: string): Promise<boolean> {
    // 首先在原始文件所在目录搜索
    const originalDir = path.dirname(originalFilePath);
    
    console.log(`在文件所在目录 ${originalDir} 中搜索代码片段: ${snippet}`);
    
    // 搜索当前目录下的所有文件
    const currentDirFiles = await vscode.workspace.findFiles(`${originalDir.replace(/\\/g, '/')}/**`, '**/node_modules/**');
    
    for (const file of currentDirFiles) {
      const foundFilePath = await this._searchAndJumpInFile(file.fsPath, snippet);
      if (foundFilePath) {
        // 更新记录的文件路径
        this._dataManager.updateReferenceTargetFilePath(referenceId, foundFilePath);
        return true;
      }
    }
    
    // 如果在当前目录没找到，向上递归搜索父级目录
    let parentDir = path.dirname(originalDir);
    const rootPath = path.parse(originalDir).root; // 获取盘符或根目录
    
    while (parentDir !== rootPath && parentDir !== '.') {
      console.log(`在父级目录 ${parentDir} 中搜索代码片段: ${snippet}`);
      
      // 搜索当前父目录下的所有文件
      const parentDirFiles = await vscode.workspace.findFiles(`${parentDir.replace(/\\/g, '/')}/**`, '**/node_modules/**');
      
      for (const file of parentDirFiles) {
        const foundFilePath = await this._searchAndJumpInFile(file.fsPath, snippet);
        if (foundFilePath) {
          // 更新记录的文件路径
          this._dataManager.updateReferenceTargetFilePath(referenceId, foundFilePath);
          return true;
        }
      }
      
      // 继续向上一级目录搜索
      const nextParentDir = path.dirname(parentDir);
      if (nextParentDir === parentDir) {
        // 已经到达根目录
        break;
      }
      parentDir = nextParentDir;
    }
    
    return false;
  }
  
  // 全局搜索并在找到后跳转
  private async _globalSearchAndJump(reference: ReferenceItem): Promise<void> {
    if (!reference.snippet) {
      return;
    }
    
    const snippet = reference.snippet;
    
    // 先获取当前工作区的所有文件
    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 10000);
    console.log('全局搜索文件数量:', files.length);

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
      
      // 更新记录的文件路径
      if (reference.targetFilePath !== matchFile.fsPath) {
        this._dataManager.updateReferenceTargetFilePath(reference.id, matchFile.fsPath);
      }
    } else if (matchCount === 0) {
      vscode.window.showWarningMessage('未找到匹配的代码片段');
    } else {
      vscode.window.showWarningMessage('代码片段已不是全局唯一');
    }
  }
}