# 邮件分发兼容更新记录

截至 2026-06-23 的当前实现已经从“本地代理优先 + 后端文件配置”调整为“应用内邮箱配置 + Rust Tauri 命令直连”。

## 当前行为

- 用户在月薪喵邮件面板填写 163 邮箱授权码、SMTP 主机和 IMAP 主机。
- 前端把配置保存到 WebView `localStorage`。
- 发送邮件调用 `invoke('send_mail', { payload })`。
- 收件箱刷新和未读提醒调用 `invoke('fetch_mail_inbox', { config })`。
- 未读提醒使用 60 秒轮询，不再订阅 `http://127.0.0.1:1421/events`。
- 旧版 `scripts/mail-inbox-server.cjs` 本地代理脚本已移除，避免继续保留后端授权码配置入口。

## 分发意义

安装包不需要携带邮箱授权码，目标电脑用户也不需要手动创建 `%APPDATA%\monthly-salary-cat\mail.local.json`。换电脑或换系统用户后，在应用邮件面板重新填写即可。
