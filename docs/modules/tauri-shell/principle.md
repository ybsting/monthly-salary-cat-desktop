# Tauri 桌面壳模块原理文档

Tauri 桌面壳负责把 Vue 前端放入 Windows WebView2 中运行，并通过 Rust 命令提供系统能力。

正式安装后的可执行文件使用 Windows GUI 子系统启动。`src-tauri/src/main.rs` 在 release 模式启用 `windows_subsystem = "windows"`，因此用户双击运行时不会显示后端命令框窗口；开发调试仍可通过 `npm run tauri:dev` 在终端中观察构建和日志。

本机打包依赖 Cargo 运行 Rust 依赖的 build script 和 proc-macro DLL。如果 Windows Smart App Control / Code Integrity 阻止这些未签名临时产物运行，可以改用 `.github/workflows/windows-build.yml` 在 GitHub Actions 的 Windows runner 上打包。该方式不需要关闭本机安全策略，workflow 会执行 `npm ci` 和 `npm run tauri:build`，并上传 NSIS 安装器 artifact。

## 窗口与托盘

主窗口配置在 `src-tauri/tauri.conf.json`，默认 320x320、透明、无边框、置顶且不显示在任务栏。系统托盘在 `build_tray()` 中创建，图标来自 `src-tauri/icons/tray-icon.png`，菜单提供“唤醒/隐藏宠物”和“退出宠物”。

## 单实例原则

月薪喵使用 `tauri-plugin-single-instance` 限制同一主机上只运行一个应用实例。该插件在 `src-tauri/src/lib.rs` 中作为 `tauri::Builder` 的第一个插件注册，避免其他插件先处理启动流程。第一次启动的进程持有实例锁；用户再次双击应用程序时，第二个进程会把启动事件转发给已有进程并退出，已有进程负责显示、取消最小化并聚焦主窗口。

## 图标一致性

Tauri 打包使用 `bundle.icon` 中的 PNG/ICO 资源。当前这些资源由托盘图标 `tray-icon.png` 生成，并额外保留与托盘 PNG 完全同源的 `64x64.png`；Windows 可执行文件使用的 `icon.ico` 覆盖 16、24、32、48、64、128、256 像素尺寸，因此用户在安装包、可执行文件和系统托盘中看到的是同一套图标视觉。

## 邮件命令原则

邮箱授权码属于用户运行期配置，不属于后端部署配置。前端在邮件面板保存授权码到 WebView `localStorage`，调用 `send_mail` 或 `fetch_mail_inbox` 时随参数传入 Rust。Rust 只在本次请求中使用授权码，不把它写入文件，也不从安装目录读取授权码。
