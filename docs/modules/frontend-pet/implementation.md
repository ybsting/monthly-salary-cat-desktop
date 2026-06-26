# 前端宠物模块实现文档

## 文件范围

| 文件 | 职责 |
| --- | --- |
| `src/components/SalaryCat.vue` | 桌宠主组件、右键菜单、工具面板、邮箱/新闻/翻译配置持久化 |
| `src/styles.css` | 桌宠、气泡、菜单、阅读/翻译/新闻/邮件面板样式 |

## 邮件面板实现

- 邮件面板包含“发送/收件箱”两个 Tab。
- 面板顶部提供 `163 邮箱授权码`、`SMTP 主机`、`IMAP 主机` 三个配置输入框。
- 配置通过 `watch([mailTo, mailAuthCode, mailSmtpHost, mailImapHost])` 保存到 WebView `localStorage`。
- 发送按钮调用 `sendMail()`，最终通过 Tauri `invoke('send_mail')` 交给 Rust。
- 收件箱刷新调用 `fetchMailInbox()`，最终通过 Tauri `invoke('fetch_mail_inbox')` 交给 Rust。
- 收件箱类型 `MailInboxItem.body` 定义于 `src/components/SalaryCat.vue:70`；详情页模板位于 `src/components/SalaryCat.vue:1553`，优先展示完整正文 `selectedMailInboxItem.body`，列表仍展示摘要 `preview`。
- 新邮件提醒由 `startMailInboxFallbackPolling()` 每 60 秒轮询 Rust 收件箱实现。

## localStorage 键

- `monthlySalaryCat.mail.to`
- `monthlySalaryCat.mail.authCode`
- `monthlySalaryCat.mail.smtpHost`
- `monthlySalaryCat.mail.imapHost`
- `monthlySalaryCat.news.juheKey`
- `monthlySalaryCat.translation.*`
