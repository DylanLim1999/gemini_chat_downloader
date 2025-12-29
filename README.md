# Gemini 对话导出插件

一个简洁实用的 Chrome 扩展，用于将 Gemini AI 对话内容一键导出为 Markdown 格式。

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue)
![Version](https://img.shields.io/badge/version-1.0-green)

## ✨ 功能特性

- � **一键导出** - 点击扩展图标即可下载当前对话为 `.md` 文件
- 📋 **复制到剪贴板** - 快速复制对话内容
- � **自动加载完整对话** - 自动滚动加载所有历史对话，无需手动滚动
- �📝 **完整格式保留** - 代码块、列表、链接等格式完美转换
- 🎯 **智能命名** - 自动基于对话标题和日期生成文件名

## 📦 安装方法

1. 下载本仓库代码
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择本项目文件夹

## 🚀 使用说明

1. 打开 [Gemini](https://gemini.google.com) 并进入一个对话
2. 点击浏览器工具栏中的扩展图标
3. 选择「下载 Markdown」或「复制到剪贴板」

### 选项说明

- **加载完整对话**：开启后会自动滚动加载所有历史对话（默认开启）

## 📁 文件结构

```
├── manifest.json          # 扩展配置文件
├── popup.html/js          # 弹出界面
├── content.js             # 核心逻辑
├── background.js          # 后台脚本
├── turndown.js            # HTML→Markdown 转换库
└── icon*.png              # 扩展图标
```

## 🔧 技术栈

- Chrome Extension Manifest V3
- [Turndown.js](https://github.com/mixmark-io/turndown) - HTML 到 Markdown 转换

## 📄 许可证

MIT License
