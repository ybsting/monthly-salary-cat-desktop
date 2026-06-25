# 月薪喵

一个使用 Tauri v2、Vue 3、TypeScript 实现的透明置顶桌面宠物应用。

## 运行

```bash
npm install
npm run tauri:dev
```

日常桌面启动使用 `启动月薪喵.vbs`，它会隐藏调用 `scripts/start-background.ps1`，默认后台静默运行，不依赖 Vite 交互终端或需要保持打开的控制台窗口。启动器会用 `scripts/desktop-web-server.cjs` 在本机 `1420` 端口服务 `dist/` 前端资源。

## 功能

- 透明无边框、置顶、可拖拽桌面宠物。
- 单实例运行：同一台主机只保留一个月薪喵进程，重复双击应用会唤醒已运行的宠物窗口。
- 右键菜单支持阅读、翻译、新闻、邮件、隐藏和退出。
- 邮件面板支持应用内填写 163 邮箱授权码、SMTP 主机和 IMAP 主机。
- 邮件发送和收件箱读取直接通过 Tauri Rust 命令 `send_mail`、`fetch_mail_inbox` 完成，不再要求用户创建后端 `mail.local.json`。
- 邮箱授权码保存在当前用户 WebView 的 `localStorage`：`monthlySalaryCat.mail.authCode`；SMTP/IMAP 主机分别保存在 `monthlySalaryCat.mail.smtpHost`、`monthlySalaryCat.mail.imapHost`。
- 新闻、翻译等前端配置同样保存在 WebView `localStorage`。
- 新邮件提醒使用前端 60 秒轮询 Rust `fetch_mail_inbox`，依赖应用内填写的邮箱配置。

## 邮箱配置

在月薪喵右键菜单打开“邮件”，填写：

- `163 邮箱授权码`
- `SMTP 主机`，默认 `smtp.163.com`
- `IMAP 主机`，默认 `imap.163.com`

授权码不再从 Rust 后端配置文件读取，也不会打进安装包。配置落点是当前 Windows 用户的 WebView 数据目录中的 `localStorage`，换电脑或换 Windows 用户后需要重新填写。

## 图标

应用打包图标 `src-tauri/icons/32x32.png`、`src-tauri/icons/64x64.png`、`src-tauri/icons/128x128.png`、`src-tauri/icons/128x128@2x.png` 和 `src-tauri/icons/icon.ico` 已由 `src-tauri/icons/tray-icon.png` 重新生成，其中 `64x64.png` 与托盘 PNG 完全同源，`icon.ico` 覆盖 16、24、32、48、64、128、256 像素尺寸，因此安装包、可执行文件和托盘图标使用同一套视觉来源。

## 构建安装包

```bash
npm run tauri:build
```

该命令调用 `scripts/tauri-build.cmd`。脚本会自动探测 Visual Studio C++ Build Tools，并使用 PATH 中的 Cargo，不再绑定本机绝对路径。当前 Tauri 配置只构建 Windows NSIS `.exe` 安装器，产物位于：

```text
src-tauri/target/release/bundle/nsis/
```

如果本机启用了 Smart App Control / Code Integrity，并拦截 Cargo 生成的未签名 build script 或 proc-macro DLL，可以使用 GitHub Actions 云端打包，避免降低本机安全策略：

1. 推送代码到 GitHub。
2. 打开仓库的 `Actions`。
3. 选择 `Build Windows Installer`。
4. 点击 `Run workflow`。
5. 构建完成后，在本次 workflow 的 `Artifacts` 下载 `monthly-salary-cat-windows-installer`。
