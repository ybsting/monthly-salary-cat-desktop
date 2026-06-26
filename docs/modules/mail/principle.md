# 邮件模块原理文档

## 核心流程

邮件模块现在采用“前端保存用户配置 + Rust 后端执行邮箱协议”的结构。用户在月薪喵邮件面板中填写 163 邮箱授权码、SMTP 主机和 IMAP 主机；前端将这些值保存到 WebView `localStorage`，并在发送或收件箱读取时作为 Tauri 命令参数传给 Rust。

Rust 后端不再读取 `src-tauri/mail.local.json`、`%APPDATA%\monthly-salary-cat\mail.local.json` 或邮箱授权码环境变量。这样安装包分发后，用户只需要在应用内填写配置，不需要编辑后端文件。

## 发送流程

1. 用户打开“邮件”面板。
2. 用户填写授权码、收件人、主题、正文，可选附件和定时发送时间。
3. `createMailPayload()` 校验输入并把 `mailConfig` 放入 payload。
4. 立即发送时，`sendMailPayload()` 调用 `invoke('send_mail', { payload })`。
5. 定时发送时，前端用 `setTimeout` 保存当时的 payload，到点后复用 `sendMailPayload()`。
6. Rust `send_mail()` 使用 `spawn_blocking` 调用同步 SMTP 发送逻辑。
7. Rust 使用 `lettre` 构建 MIME multipart 邮件，并用 `Credentials::new(MAIL_SENDER, authCode)` 登录 SMTP。

## 收件与提醒流程

1. 用户切换到“收件箱”或点击刷新。
2. `fetchMailInboxItems()` 调用 `invoke('fetch_mail_inbox', { config })`。
3. Rust 使用 IMAP over TLS 连接 `imapHost:993`，登录后发送 IMAP `ID` 客户端标识，再读取最近 10 封邮件。
4. Rust 的 `parse_inbox_item()`（`src-tauri/src/lib.rs`）调用 `extract_mail_body()`（`src-tauri/src/lib.rs`）提取完整正文，写入 `MailInboxItem.body`；再用 `normalize_mail_preview()`（`src-tauri/src/lib.rs`）从完整正文生成 120 字符列表摘要。
5. 前端列表只展示 `preview`，点击邮件后详情页模板（`src/components/SalaryCat.vue`）优先展示 `selectedMailInboxItem.body`，因此邮件详情不再被摘要长度截断。
6. 如果邮件只有 HTML 正文，`normalize_mail_body()` 和 `strip_html_tags()`（均在 `src-tauri/src/lib.rs`）会清理标签后展示完整可读文本。
7. 应用启动且授权码存在时，`connectMailInboxEvents()`（`src/components/SalaryCat.vue`）启动 60 秒轮询；轮询发现新 id 后调用 `showNewMailNotification()`（`src/components/SalaryCat.vue`）展示持久气泡。

## 安全边界

授权码从“后端私有配置文件”迁移到“前端 WebView localStorage”。这让普通用户可以在应用内设置，但 localStorage 不是系统级密钥库。它适合当前单机桌宠场景；如果后续需要更强保护，应接入系统凭据管理或 Tauri store/stronghold 类方案。
