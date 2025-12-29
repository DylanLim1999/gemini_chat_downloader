// background.js (v2.0)
// 后台服务脚本 - 目前主要用于扩展生命周期管理

console.log('[GEMINI-EXPORT-BG] Background script loaded. Version 2.0');

// 监听扩展安装/更新事件
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[GEMINI-EXPORT-BG] Extension installed.');
    } else if (details.reason === 'update') {
        console.log('[GEMINI-EXPORT-BG] Extension updated to version', chrome.runtime.getManifest().version);
    }
});

// 转发 content script 的消息到 popup（用于进度更新）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'progress') {
        // 转发进度消息到所有活动的扩展页面
        chrome.runtime.sendMessage(message).catch(() => {
            // popup 可能已关闭，忽略错误
        });
    }
    return true;
});
