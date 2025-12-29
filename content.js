// content.js (v2.0 - 增强版：自动滚动加载 + 进度回调)

(function () {
  "use strict";

  const LOG_PREFIX = "[GEMINI-MD-EXPORT]";
  const VERSION = "2.0";

  console.log(
    `${LOG_PREFIX} Script loaded. Version ${VERSION} (Auto-scroll Enhanced).`
  );

  // 初始化 TurndownService
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
    linkReferenceStyle: "full",
  });

  // 使用 GFM 插件支持表格等
  if (typeof TurndownPluginGfmService !== "undefined") {
    turndownService.use(TurndownPluginGfmService.gfm);
  }

  // 状态变量
  let isLoading = false;
  let shouldCancel = false;

  /**
   * 延时函数
   */
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取滚动容器
   */
  function getScrollContainer() {
    // Gemini 页面的主要滚动容器选择器（按优先级排序）
    const selectors = [
      // Gemini 特定选择器
      'infinite-scroller',
      '.infinite-scroller',
      '[class*="conversation"]',
      '[class*="chat-history"]',
      '[class*="message-list"]',
      // 通用选择器
      '[role="main"]',
      'main',
      '.conversation-container',
      '.chat-container',
    ];

    // 首先尝试找到包含对话的父元素
    const firstTurn = document.querySelector('user-query, model-response');
    if (firstTurn) {
      // 向上查找可滚动的父元素
      let parent = firstTurn.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const isScrollable = 
          (style.overflow === 'auto' || style.overflow === 'scroll' ||
           style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          parent.scrollHeight > parent.clientHeight;
        
        if (isScrollable) {
          console.log(`${LOG_PREFIX} Found scroll container via parent traversal:`, parent.tagName, parent.className);
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    // 尝试预定义的选择器
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.scrollHeight > el.clientHeight) {
        console.log(`${LOG_PREFIX} Found scroll container: ${selector}`);
        return el;
      }
    }

    // 最后使用 document.documentElement
    console.log(`${LOG_PREFIX} Using document.documentElement as scroll container`);
    return document.documentElement;
  }

  /**
   * 获取当前对话轮次数量
   */
  function getConversationTurnCount() {
    return document.querySelectorAll("user-query, model-response").length;
  }

  /**
   * 自动滚动加载完整对话
   * @param {Function} onProgress - 进度回调函数 (percent, message)
   */
  async function loadFullConversation(onProgress) {
    console.log(`${LOG_PREFIX} Starting full conversation load...`);

    const container = getScrollContainer();
    console.log(`${LOG_PREFIX} Scroll container:`, container.tagName, container.className);
    
    let previousScrollHeight = 0;
    let previousTurnCount = 0;
    let noChangeCount = 0;
    const maxNoChangeRetries = 5; // 连续5次没有变化就认为加载完成
    const maxAttempts = 200; // 最大尝试次数
    let attempts = 0;

    // 记录初始状态
    let currentTurnCount = getConversationTurnCount();
    console.log(`${LOG_PREFIX} Initial turn count: ${currentTurnCount}`);

    onProgress?.(5, `开始加载... (${currentTurnCount} 条)`);

    while (attempts < maxAttempts && !shouldCancel) {
      attempts++;
      previousTurnCount = currentTurnCount;
      previousScrollHeight = container.scrollHeight;

      // 滚动到顶部 - 尝试多种方式
      container.scrollTop = 0;
      window.scrollTo(0, 0);
      
      // 也尝试滚动第一个对话元素到视图中
      const firstTurn = document.querySelector('user-query');
      if (firstTurn) {
        firstTurn.scrollIntoView({ behavior: 'instant', block: 'start' });
      }

      // 等待内容加载 - 增加等待时间
      await delay(500);

      // 获取新的状态
      currentTurnCount = getConversationTurnCount();
      const currentScrollHeight = container.scrollHeight;

      // 计算进度
      const estimatedProgress = Math.min(90, attempts * 2);

      // 检查是否有新内容（通过对话数量或滚动高度变化）
      const hasNewContent = 
        currentTurnCount > previousTurnCount || 
        currentScrollHeight > previousScrollHeight;

      if (hasNewContent) {
        noChangeCount = 0;
        console.log(
          `${LOG_PREFIX} New content loaded: turns ${previousTurnCount} -> ${currentTurnCount}, height ${previousScrollHeight} -> ${currentScrollHeight}`
        );
        onProgress?.(
          estimatedProgress,
          `正在加载对话... (${currentTurnCount} 条)`
        );
      } else {
        noChangeCount++;
        console.log(
          `${LOG_PREFIX} No new content (attempt ${noChangeCount}/${maxNoChangeRetries})`
        );

        if (noChangeCount >= maxNoChangeRetries) {
          console.log(
            `${LOG_PREFIX} Loading complete. Total turns: ${currentTurnCount}`
          );
          break;
        }
        
        // 额外等待一下再重试
        await delay(300);
      }
    }

    if (shouldCancel) {
      console.log(`${LOG_PREFIX} Loading cancelled by user.`);
      return null;
    }

    onProgress?.(95, "正在提取对话内容...");

    // 滚动回底部让用户继续使用
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

    console.log(
      `${LOG_PREFIX} Full conversation loaded. Total attempts: ${attempts}, Total turns: ${currentTurnCount}`
    );
    return currentTurnCount;
  }

  /**
   * 净化文件名
   */
  function sanitizeFilename(title) {
    const invalidChars = ["\\", "/", ":", "*", "?", '"', "<", ">", "|"];
    let sanitizedTitle = title;
    for (const char of invalidChars) {
      sanitizedTitle = sanitizedTitle.split(char).join("_");
    }
    return sanitizedTitle.trim() || "gemini-chat";
  }

  /**
   * 提取对话内容并转换为 Markdown
   */
  function extractConversationMarkdown() {
    console.log(`${LOG_PREFIX} Extracting conversation content.`);

    // 尝试多种选择器获取标题
    const titleSelectors = [
      ".conversation.selected .conversation-title",
      ".conversation-title.gds-label-l",
      '[data-test-id="conversation-title"]',
      "h1.title",
      ".chat-title",
    ];

    let title = "Gemini Conversation";
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el?.innerText?.trim()) {
        title = el.innerText.trim();
        break;
      }
    }

    console.log(`${LOG_PREFIX} Title: ${title}`);

    let markdownContent = `# ${title}\n\n`;
    const turns = document.querySelectorAll("user-query, model-response");
    console.log(`${LOG_PREFIX} Found ${turns.length} conversation turns.`);

    if (turns.length === 0) {
      console.error(`${LOG_PREFIX} No conversation content found.`);
      return null;
    }

    turns.forEach((turn, index) => {
      if (turn.tagName.toLowerCase() === "user-query") {
        const queryText = turn.querySelector(".query-text")?.innerText;
        if (queryText) {
          markdownContent += `## User\n\n${queryText}\n\n---\n\n`;
        }
      } else if (turn.tagName.toLowerCase() === "model-response") {
        const responseEl = turn.querySelector(".markdown");
        if (responseEl) {
          const htmlContent = responseEl.innerHTML;
          const formattedText = turndownService.turndown(htmlContent);
          markdownContent += `## Gemini\n\n${formattedText.trim()}\n\n---\n\n`;
        }
      }
    });

    return { title, content: markdownContent, turnCount: turns.length };
  }

  /**
   * 下载对话为 Markdown 文件
   */
  async function downloadConversation(options = {}) {
    const { fullLoad = true, onProgress } = options;

    console.log(
      `${LOG_PREFIX} Download command received. Full load: ${fullLoad}`
    );
    shouldCancel = false;
    isLoading = true;

    try {
      if (fullLoad) {
        onProgress?.(5, "开始加载完整对话...");
        await loadFullConversation(onProgress);

        if (shouldCancel) {
          return { success: false, error: "cancelled" };
        }
      }

      onProgress?.(95, "正在生成文件...");

      const result = extractConversationMarkdown();
      if (!result) {
        console.error(`${LOG_PREFIX} Failed to extract conversation content.`);
        return { success: false, error: "No conversation content found" };
      }

      const { title, content, turnCount } = result;

      // 生成带日期的文件名
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate()
      )}`;
      const filename = sanitizeFilename(`Gemini-${title}-${dateStr}`) + ".md";

      console.log(`${LOG_PREFIX} Filename: ${filename}`);

      // 创建并下载文件
      const blob = new Blob([content], {
        type: "text/markdown;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onProgress?.(100, "下载完成！");
      console.log(`${LOG_PREFIX} Download triggered successfully.`);

      return { success: true, turnCount, filename };
    } catch (error) {
      console.error(`${LOG_PREFIX} Download error:`, error);
      return { success: false, error: error.message };
    } finally {
      isLoading = false;
    }
  }

  /**
   * 复制对话到剪贴板
   */
  async function copyConversationToClipboard(options = {}) {
    const { fullLoad = true, onProgress } = options;

    console.log(
      `${LOG_PREFIX} Copy to clipboard command received. Full load: ${fullLoad}`
    );
    shouldCancel = false;
    isLoading = true;

    try {
      if (fullLoad) {
        onProgress?.(5, "开始加载完整对话...");
        await loadFullConversation(onProgress);

        if (shouldCancel) {
          return { success: false, error: "cancelled" };
        }
      }

      onProgress?.(95, "正在复制到剪贴板...");

      const result = extractConversationMarkdown();
      if (!result) {
        console.error(`${LOG_PREFIX} Failed to extract conversation content.`);
        return { success: false, error: "No conversation content found" };
      }

      const { content, turnCount } = result;

      // 尝试使用现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
        console.log(`${LOG_PREFIX} Content copied to clipboard successfully.`);
      } else {
        // 降级方案
        await fallbackCopyToClipboard(content);
      }

      onProgress?.(100, "复制完成！");
      return { success: true, turnCount };
    } catch (error) {
      console.error(`${LOG_PREFIX} Copy error:`, error);
      return { success: false, error: error.message };
    } finally {
      isLoading = false;
    }
  }

  /**
   * 降级复制方案
   */
  function fallbackCopyToClipboard(text) {
    return new Promise((resolve, reject) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.cssText =
        "position:fixed;top:-9999px;left:-9999px;opacity:0;";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand("copy");
        if (successful) {
          console.log(`${LOG_PREFIX} Content copied using fallback method.`);
          resolve();
        } else {
          reject(new Error("execCommand copy failed"));
        }
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(textArea);
      }
    });
  }

  /**
   * 取消当前操作
   */
  function cancelOperation() {
    console.log(`${LOG_PREFIX} Cancel requested.`);
    shouldCancel = true;
  }

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`${LOG_PREFIX} Received message:`, request.action);

    // 创建进度回调
    const sendProgress = (percent, message) => {
      chrome.runtime
        .sendMessage({
          type: "progress",
          percent,
          message,
        })
        .catch(() => {}); // 忽略错误（popup 可能已关闭）
    };

    if (request.action === "download_markdown") {
      const options = {
        fullLoad: request.fullLoad !== false,
        onProgress: sendProgress,
      };

      downloadConversation(options).then((result) => {
        sendResponse(result);
      });
      return true; // 保持消息通道开放
    } else if (request.action === "copy_markdown") {
      const options = {
        fullLoad: request.fullLoad !== false,
        onProgress: sendProgress,
      };

      copyConversationToClipboard(options).then((result) => {
        sendResponse(result);
      });
      return true;
    } else if (request.action === "cancel") {
      cancelOperation();
      sendResponse({ success: true });
      return true;
    } else if (request.action === "ping") {
      // 用于检测 content script 是否已加载
      sendResponse({ success: true, version: VERSION });
      return true;
    }
  });
})();
