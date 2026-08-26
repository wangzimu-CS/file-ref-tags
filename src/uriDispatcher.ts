// uriDispatcher.ts
import * as vscode from 'vscode';

type UriCallback = (uri: vscode.Uri) => Promise<void>;

// 路由注册表：path前缀 → 回调函数（回调可以携带各自子模块的闭包）
const routeMap = new Map<string, UriCallback>();

/**
 * 子模块调用此函数，把自己闭包里的处理函数注册进来
 */
export function registerUriRoute(routePath: string, callback: UriCallback) {
    routeMap.set(routePath, callback);
}

/**
 * 唯一入口，给主扩展 registerUriHandler 使用
 */
export async function rootHandleUri(uri: vscode.Uri) {
    const fn = routeMap.get(uri.path);
    if (fn) {
        await fn(uri);
    } else {
        vscode.window.showErrorMessage(`未知协议路由:${uri.path}`);
    }
}
