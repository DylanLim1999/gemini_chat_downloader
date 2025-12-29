// popup.js (v2.0 - 增强版：进度显示 + 取消功能)

document.addEventListener('DOMContentLoaded', function() {
    // 获取 DOM 元素
    const downloadBtn = document.getElementById('downloadBtn');
    const copyBtn = document.getElementById('copyBtn');
    const fullLoadToggle = document.getElementById('fullLoadToggle');
    const progressSection = document.getElementById('progressSection');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    const progressBar = document.getElementById('progressBar');
    const cancelBtn = document.getElementById('cancelBtn');
    const status = document.getElementById('status');

    let currentTabId = null;
    let isProcessing = false;

    /**
     * 显示状态消息
     */
    function showStatus(message, type = 'success') {
        status.textContent = message;
        status.className = `status active ${type}`;
        
        // 添加图标
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };
        status.innerHTML = `<span class="status-icon">${icons[type] || ''}</span>${message}`;
    }

    /**
     * 隐藏状态消息
     */
    function hideStatus() {
        status.className = 'status';
    }

    /**
     * 显示进度区域
     */
    function showProgress() {
        progressSection.classList.add('active');
        progressBar.style.width = '0%';
        progressBar.classList.remove('indeterminate');
        hideStatus();
    }

    /**
     * 隐藏进度区域
     */
    function hideProgress() {
        progressSection.classList.remove('active');
    }

    /**
     * 更新进度
     */
    function updateProgress(percent, message) {
        progressText.textContent = message || '处理中...';
        progressPercent.textContent = `${Math.round(percent)}%`;
        progressBar.style.width = `${percent}%`;
        progressBar.classList.remove('indeterminate');
    }

    /**
     * 显示不确定进度（循环动画）
     */
    function showIndeterminateProgress(message) {
        progressText.textContent = message || '处理中...';
        progressPercent.textContent = '';
        progressBar.classList.add('indeterminate');
    }

    /**
     * 设置按钮状态
     */
    function setButtonsEnabled(enabled) {
        downloadBtn.disabled = !enabled;
        copyBtn.disabled = !enabled;
        isProcessing = !enabled;
    }

    /**
     * 获取完整加载选项状态
     */
    function isFullLoadEnabled() {
        return fullLoadToggle.classList.contains('active');
    }

    /**
     * 检查标签页是否是 Gemini 页面
     */
    async function checkGeminiPage() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const currentTab = tabs[0];
                currentTabId = currentTab?.id;
                
                if (!currentTab?.url || !currentTab.url.startsWith('https://gemini.google.com')) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * 发送消息到 content script
     */
    async function sendToContentScript(message) {
        return new Promise((resolve, reject) => {
            if (!currentTabId) {
                reject(new Error('No active tab'));
                return;
            }
            
            chrome.tabs.sendMessage(currentTabId, message, function(response) {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * 处理下载操作
     */
    async function handleDownload() {
        if (isProcessing) return;
        
        setButtonsEnabled(false);
        showProgress();
        
        const fullLoad = isFullLoadEnabled();
        
        if (fullLoad) {
            showIndeterminateProgress('正在加载完整对话...');
        } else {
            updateProgress(50, '正在提取对话内容...');
        }

        try {
            const response = await sendToContentScript({
                action: 'download_markdown',
                fullLoad: fullLoad
            });

            hideProgress();

            if (response?.success) {
                const turnCount = response.turnCount || 0;
                showStatus(`下载成功！共 ${turnCount} 条对话`, 'success');
                setTimeout(() => window.close(), 1500);
            } else if (response?.error === 'cancelled') {
                showStatus('已取消', 'warning');
            } else {
                showStatus(response?.error || '下载失败', 'error');
            }
        } catch (error) {
            hideProgress();
            console.error('Download error:', error);
            showStatus('下载失败：' + error.message, 'error');
        } finally {
            setButtonsEnabled(true);
        }
    }

    /**
     * 处理复制操作
     */
    async function handleCopy() {
        if (isProcessing) return;
        
        setButtonsEnabled(false);
        showProgress();
        
        const fullLoad = isFullLoadEnabled();
        
        if (fullLoad) {
            showIndeterminateProgress('正在加载完整对话...');
        } else {
            updateProgress(50, '正在提取对话内容...');
        }

        try {
            const response = await sendToContentScript({
                action: 'copy_markdown',
                fullLoad: fullLoad
            });

            hideProgress();

            if (response?.success) {
                const turnCount = response.turnCount || 0;
                showStatus(`已复制！共 ${turnCount} 条对话`, 'success');
                setTimeout(() => window.close(), 1500);
            } else if (response?.error === 'cancelled') {
                showStatus('已取消', 'warning');
            } else {
                showStatus(response?.error || '复制失败', 'error');
            }
        } catch (error) {
            hideProgress();
            console.error('Copy error:', error);
            showStatus('复制失败：' + error.message, 'error');
        } finally {
            setButtonsEnabled(true);
        }
    }

    /**
     * 处理取消操作
     */
    async function handleCancel() {
        try {
            await sendToContentScript({ action: 'cancel' });
            hideProgress();
            showStatus('已取消', 'warning');
            setButtonsEnabled(true);
        } catch (error) {
            console.error('Cancel error:', error);
        }
    }

    /**
     * 监听来自 content script 的进度消息
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'progress') {
            updateProgress(message.percent, message.message);
        }
    });

    /**
     * 初始化
     */
    async function init() {
        const isGemini = await checkGeminiPage();
        
        if (!isGemini) {
            setButtonsEnabled(false);
            showStatus('请在 Gemini 页面使用此插件', 'warning');
            return;
        }

        // 绑定事件
        downloadBtn.addEventListener('click', handleDownload);
        copyBtn.addEventListener('click', handleCopy);
        cancelBtn.addEventListener('click', handleCancel);
        
        // 切换完整加载选项
        fullLoadToggle.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    }

    init();
});