# 邮件模块实现文档

## 文件范围

| 文件 | 职责 |
| --- | --- |
| `src/components/SalaryCat.vue` | 邮件面板、授权码/SMTP/IMAP 输入、localStorage 持久化、发送/收件箱/未读轮询调用 |
| `src/styles.css` | 邮件面板、配置输入框、发送表单、收件箱和附件样式 |
| `src-tauri/src/lib.rs` | `send_mail`、`fetch_mail_inbox` Tauri 命令，SMTP/IMAP 实现 |
| `src-tauri/Cargo.toml` | 邮件相关 Rust 依赖：`lettre`、`native-tls`、`mailparse` |

旧版 `scripts/mail-inbox-server.cjs` 本地代理已移除。当前邮件功能只走应用内配置和 Tauri Rust 命令，不再提供 `http://127.0.0.1:1421` 邮件代理入口。

## 前端实现

- `MailConfigPayload`：包含 `authCode`、`smtpHost`、`imapHost`。
- `MailSendPayload`：包含收件人、主题、正文、附件和 `config`。
- `mailAuthCode`：读取/保存 `monthlySalaryCat.mail.authCode`。
- `mailSmtpHost`：读取/保存 `monthlySalaryCat.mail.smtpHost`，默认 `smtp.163.com`。
- `mailImapHost`：读取/保存 `monthlySalaryCat.mail.imapHost`，默认 `imap.163.com`。
- `mailConfig`：计算当前邮箱配置，并在发送、收件箱刷新、未读轮询时传给 Rust。
- `createMailPayload()`：校验收件人、主题、正文/附件和授权码，返回包含 `config` 的 payload。
- `sendMailPayload()`：直接 `invoke('send_mail', { payload })`，并使用 `mailSendTimeoutMs = 30000` 做前端超时保护。
- `fetchMailInboxItems()`：直接 `invoke('fetch_mail_inbox', { config: mailConfig.value })`。
- `connectMailInboxEvents()`：启动 60 秒轮询，不再创建 `EventSource`。
- `pollMailInboxForNotifications()`：通过 `fetch_mail_inbox` 轮询并合并新邮件提醒。

## Rust 实现

- `MailConfigPayload`：由前端传入，不从本地文件读取授权码。
- `MailPayload`：新增 `config: MailConfigPayload`。
- `send_mail(payload)`：使用 `spawn_blocking` 调用 `send_mail_sync(payload)`。
- `fetch_mail_inbox(config)`：使用 `spawn_blocking` 调用 `fetch_mail_inbox_sync(config)`。
- `read_mail_auth_code(config)`：只读取命令参数中的授权码，为空时报错“请先在邮件面板填写 163 邮箱授权码”。
- `read_mail_smtp_host(config)`：优先使用前端传入的 SMTP 主机，否则默认 `smtp.163.com`。
- `read_mail_imap_host(config)`：优先使用前端传入的 IMAP 主机，否则默认 `imap.163.com`。

## 当前边界

- 邮箱账号仍固定为 `fsszhuochong@163.com`。
- 授权码保存在当前用户 WebView 的 `localStorage`，换用户或换电脑需要重新填写。
- 授权码不写入 Rust 后端配置文件，不打进安装包。
- 附件总大小限制为 5MB。
- 定时发送只在当前应用运行期间有效。
