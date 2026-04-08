# ReqHub

一款支持 **Mac / Windows / 浏览器** 的现代化 API 调试工具，功能对标 Postman / APIPost。

## 功能特性

- **多标签页** — 同时处理多个请求，支持 Ctrl+T 快捷键
- **HTTP 请求构建器** — 完整支持 GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS 等方法
- **丰富的 Body 类型** — JSON（语法高亮 + 格式化）、Form URL-Encoded、Form Data、Raw Text
- **认证支持** — Bearer Token、Basic Auth、API Key（Header / Query 两种位置）
- **响应查看器** — 状态码、耗时、Body 大小、语法高亮、格式化、一键复制
- **集合管理（Collections）** — 保存请求到集合，支持重命名和删除
- **历史记录** — 自动记录最近 200 条请求，按日期分组
- **环境变量** — 多环境管理，`{{变量名}}` 语法自动替换 URL / Headers / Body
- **本地持久化** — 所有数据存储在 localStorage，无需账号
- **跨平台** — 桌面端通过 Tauri + Rust/reqwest 原生发送请求（绕过 CORS），浏览器端通过 fetch

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS v3 |
| 状态管理 | Zustand + Immer |
| 代码编辑器 | CodeMirror 6（JSON / HTML / XML 高亮） |
| 桌面端 | Tauri 2 |
| 原生 HTTP | Rust + reqwest（支持 gzip / brotli 解压，无 CORS 限制） |
| 数据持久化 | localStorage（browser / Tauri webview） |

## 快速开始

### 前置依赖

- Node.js >= 18
- Rust >= 1.85（推荐通过 rustup 安装最新 stable）
- Linux 需要：`libgtk-3-dev libwebkit2gtk-4.1-dev`

### 安装与开发

```bash
npm install
npm run tauri dev    # 启动桌面端（自动编译 Rust）
npm run dev          # 仅启动前端（浏览器模式，在 http://localhost:1420）
```

### 生产构建

```bash
npm run tauri build  # 构建 Mac / Windows / Linux 安装包
npm run build        # 仅构建 Web 版本（输出到 dist/）
```

## 项目结构

```
src/
├── components/
│   ├── layout/          # TopBar, ActivityBar, Sidebar, TabBar, WorkspacePanel
│   ├── request/         # RequestPanel, KeyValueEditor, BodyEditor, AuthEditor
│   ├── response/        # ResponsePanel（Body 高亮 + Headers 查看器）
│   ├── sidebar/         # CollectionsSidebar, HistorySidebar, EnvironmentsSidebar
│   └── ui/              # Button, Input, Select, Tabs, Modal, Tooltip
├── lib/
│   ├── httpService.ts   # HTTP 抽象层（Tauri IPC / browser fetch）
│   ├── storage.ts       # localStorage 持久化
│   └── utils.ts         # 工具函数（URL 构建、变量替换、格式化）
├── store/
│   └── useAppStore.ts   # Zustand 全局状态（tabs, collections, history, envs）
└── types/
    └── index.ts         # 完整 TypeScript 类型定义

src-tauri/
└── src/
    └── lib.rs           # Rust HTTP 引擎（send_request 命令）
```
