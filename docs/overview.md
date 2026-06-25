# 项目总览

“月薪喵”是一个 Tauri v2 + Vue 3 + TypeScript 桌面宠物应用。前端负责宠物渲染、工具面板、配置保存和用户交互；Rust 后端负责 Tauri 窗口、托盘、新闻代理、SMTP 发信和 IMAP 收信。

## 技术栈

- 前端：Vue 3、TypeScript、Vite
- 桌面壳：Tauri v2、Rust
- 邮件：Rust `lettre` 发送 SMTP，`native-tls` + 轻量 IMAP 命令读取收件箱，`mailparse` 解析邮件
- 新闻：前端保存聚合数据 Key，Rust `reqwest` 代理请求
- 图标：`src-tauri/icons/tray-icon.png` 是托盘图标和打包图标的共同来源，`64x64.png` 直接对齐托盘图标尺寸

## 模块职责

| 模块 | 主要文件 | 职责 |
| --- | --- | --- |
| 前端宠物 | `src/components/SalaryCat.vue`、`src/styles.css` | 桌宠显示、右键菜单、阅读/翻译/新闻/邮件面板、localStorage 配置保存 |
| 邮件 | `src/components/SalaryCat.vue`、`src-tauri/src/lib.rs` | 应用内填写邮箱授权码，直接 invoke Rust `send_mail` / `fetch_mail_inbox`，支持发送、定时发送、收件箱、附件下载和未读轮询 |
| Tauri 桌面壳 | `src-tauri/src/lib.rs`、`src-tauri/tauri.conf.json`、`src-tauri/icons/*` | 透明窗口、单实例唤醒、托盘、Tauri 命令、安装包和图标配置 |
| 新闻 | `src/news/newsHelper.ts`、`src-tauri/src/lib.rs` | 聚合数据新闻配置、Rust 代理请求、结果展示 |
| 翻译/阅读 | `src/translation/translationHelper.ts`、`src/reading/readingHelper.ts` | 本地和在线翻译、拼音/音标/语音播放 |

## 启动与构建

- 开发：`npm run tauri:dev`
- 前端构建：`npm run build`
- 安装包构建：`npm run tauri:build`
- 云端安装包构建：GitHub Actions 手动触发 `Build Windows Installer`，产物 artifact 名称为 `monthly-salary-cat-windows-installer`
- 日常静默启动：`启动月薪喵.vbs` 调用 `scripts/start-background.ps1`，再由 `scripts/desktop-web-server.cjs` 服务 `dist/`
- 单实例行为：`src-tauri/src/lib.rs` 使用 `tauri-plugin-single-instance`，重复双击应用不会创建第二个进程，而是显示并聚焦已运行的 `main` 窗口。

## 配置落点

- 邮箱授权码：邮件面板输入，保存到 WebView `localStorage` 的 `monthlySalaryCat.mail.authCode`
- SMTP 主机：`monthlySalaryCat.mail.smtpHost`，默认 `smtp.163.com`
- IMAP 主机：`monthlySalaryCat.mail.imapHost`，默认 `imap.163.com`
- 新闻 Key：`monthlySalaryCat.news.juheKey`
- 翻译 Key：`monthlySalaryCat.translation.*`

邮箱授权码不再从 Rust 后端本地配置文件读取。安装包不会包含用户当前授权码。
