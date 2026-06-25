# 文档索引

本文档集记录“月薪喵”的模块职责、实现位置和运行原理。代码改动后必须同步更新对应模块文档。

## 模块

- [项目总览](./overview.md)
- [前端宠物模块实现](./modules/frontend-pet/implementation.md)
- [前端宠物模块原理](./modules/frontend-pet/principle.md)
- [邮件模块实现](./modules/mail/implementation.md)
- [邮件模块原理](./modules/mail/principle.md)
- [Tauri 桌面壳实现](./modules/tauri-shell/implementation.md)
- [Tauri 桌面壳原理](./modules/tauri-shell/principle.md)
- [新闻模块实现](./modules/news/implementation.md)
- [新闻模块原理](./modules/news/principle.md)
- [翻译模块实现](./modules/translation/implementation.md)
- [翻译模块原理](./modules/translation/principle.md)
- [阅读模块实现](./modules/reading/implementation.md)
- [阅读模块原理](./modules/reading/principle.md)
- [动画数据实现](./modules/animation-data/implementation.md)
- [动画数据原理](./modules/animation-data/principle.md)

## 当前分发规则

- 安装包目标为 Windows NSIS `.exe`，配置在 `src-tauri/tauri.conf.json` 的 `bundle.targets`。
- 云端安装包构建由 `.github/workflows/windows-build.yml` 提供，手动触发 `Build Windows Installer` 后会上传 NSIS 安装器 artifact。
- 月薪喵采用单实例运行，`src-tauri/src/lib.rs` 的 `tauri-plugin-single-instance` 会在重复双击时唤醒已有 `main` 窗口。
- 应用图标资源由 `src-tauri/icons/tray-icon.png` 生成，`64x64.png` 与托盘图标尺寸一致，安装包图标和托盘图标同源。
- 邮箱授权码由用户在月薪喵邮件面板填写，保存在 WebView `localStorage`，Rust 命令只接收本次请求参数，不读取后端 `mail.local.json`。
