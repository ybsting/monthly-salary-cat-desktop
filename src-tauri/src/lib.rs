use lettre::{
    message::{header::ContentType, Attachment, Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
};
use mailparse::MailHeaderMap;
use std::{
    io::{Read, Write},
    net::TcpStream,
};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

const MAIL_SENDER: &str = "fsszhuochong@163.com";
const MAIL_DEFAULT_SMTP_HOST: &str = "smtp.163.com";
const MAIL_DEFAULT_IMAP_HOST: &str = "imap.163.com";
const MAIL_IMAP_PORT: u16 = 993;
const MAX_ATTACHMENT_BYTES: usize = 5 * 1024 * 1024;
const MAIL_INBOX_LIMIT: usize = 10;
const MAIL_IMAP_CLIENT_ID: &str =
    r#"ID ("name" "MonthlySalaryCat" "version" "0.1.0" "vendor" "monthlySalaryCat" "support-email" "fsszhuochong@163.com")"#;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MailConfigPayload {
    auth_code: String,
    smtp_host: Option<String>,
    imap_host: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MailAttachmentPayload {
    file_name: String,
    mime_type: String,
    bytes: Vec<u8>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MailPayload {
    to: String,
    subject: String,
    body: String,
    attachments: Vec<MailAttachmentPayload>,
    config: MailConfigPayload,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MailInboxItem {
    id: String,
    from: String,
    subject: String,
    date: String,
    preview: String,
    body: String,
}

/// 前端也可以通过 invoke 调用这个命令，切换宠物显示状态。
#[tauri::command]
fn toggle_pet_window(app: tauri::AppHandle) {
    toggle_main_window(&app);
}

/// 前端右键菜单调用这个命令退出应用。
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 前端邮件面板调用这个命令，由 Rust 侧通过 SMTP 发送邮件。
#[tauri::command]
async fn send_mail(payload: MailPayload) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || send_mail_sync(payload))
        .await
        .map_err(|error| format!("邮件任务执行失败: {error}"))?
}

/// 前端邮件面板调用这个命令，由 Rust 侧通过 IMAP 拉取最近邮件。
#[tauri::command]
async fn fetch_mail_inbox(config: MailConfigPayload) -> Result<Vec<MailInboxItem>, String> {
    tauri::async_runtime::spawn_blocking(move || fetch_mail_inbox_sync(config))
        .await
        .map_err(|error| format!("收件箱任务执行失败: {error}"))?
}

/// 由后端代理请求聚合数据，避免前端 WebView 直连时被 CORS 拦截。
#[tauri::command]
async fn fetch_juhe_news(key: String, category: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    // Key 只在 Rust 侧用于请求第三方接口，不回写到日志或错误消息里。
    let response = client
        .get("https://v.juhe.cn/toutiao/index")
        .query(&[("type", category), ("key", key)])
        .send()
        .await
        .map_err(|error| format!("新闻请求失败: {error}"))?;

    let status = response.status();
    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("新闻响应解析失败: {error}"))?;

    if !status.is_success() {
        return Err(format!("新闻请求失败 {status}: {body}"));
    }

    Ok(body)
}

/// 同步执行邮件构建和 SMTP 发送，避免阻塞前端事件循环。
fn send_mail_sync(payload: MailPayload) -> Result<(), String> {
    let to = payload.to.trim();
    let subject = payload.subject.trim();
    let body = payload.body.trim();

    if to.is_empty() {
        return Err("请填写收件人邮箱".to_string());
    }

    if subject.is_empty() {
        return Err("请填写邮件主题".to_string());
    }

    if body.is_empty() && payload.attachments.is_empty() {
        return Err("请填写正文或选择附件".to_string());
    }

    let total_attachment_bytes: usize = payload
        .attachments
        .iter()
        .map(|attachment| attachment.bytes.len())
        .sum();

    if total_attachment_bytes > MAX_ATTACHMENT_BYTES {
        return Err("附件总大小不能超过 5MB".to_string());
    }

    let auth_code = read_mail_auth_code(&payload.config)?;
    let smtp_host = read_mail_smtp_host(&payload.config);
    let from = MAIL_SENDER
        .parse::<Mailbox>()
        .map_err(|error| format!("发件邮箱配置错误: {error}"))?;
    let to = to
        .parse::<Mailbox>()
        .map_err(|error| format!("收件人邮箱格式错误: {error}"))?;

    let mut multipart = MultiPart::mixed().singlepart(SinglePart::plain(body.to_string()));

    for attachment in payload.attachments {
        let content_type = ContentType::parse(&attachment.mime_type)
            .unwrap_or(ContentType::parse("application/octet-stream").expect("valid mime type"));
        multipart = multipart.singlepart(
            Attachment::new(attachment.file_name).body(attachment.bytes, content_type),
        );
    }

    let email = Message::builder()
        .from(from)
        .to(to)
        .subject(subject)
        .multipart(multipart)
        .map_err(|error| format!("邮件内容构建失败: {error}"))?;

    let credentials = Credentials::new(MAIL_SENDER.to_string(), auth_code);
    let mailer = SmtpTransport::relay(&smtp_host)
        .map_err(|error| format!("SMTP 服务器配置失败: {error}"))?
        .credentials(credentials)
        .build();

    mailer
        .send(&email)
        .map(|_| ())
        .map_err(|error| format!("邮件发送失败: {error}"))
}

/// 同步连接 IMAP 收件箱并读取最近邮件摘要。
fn fetch_mail_inbox_sync(config: MailConfigPayload) -> Result<Vec<MailInboxItem>, String> {
    let auth_code = read_mail_auth_code(&config)?;
    let imap_host = read_mail_imap_host(&config);
    let tls = native_tls::TlsConnector::builder()
        .build()
        .map_err(|error| format!("IMAP TLS 初始化失败: {error}"))?;

    let tcp_stream = TcpStream::connect((imap_host.as_str(), MAIL_IMAP_PORT))
        .map_err(|error| format!("IMAP 连接失败: {error}"))?;
    let mut stream = tls
        .connect(imap_host.as_str(), tcp_stream)
        .map_err(|error| format!("IMAP TLS 握手失败: {error}"))?;
    let greeting =
        read_imap_line(&mut stream).map_err(|error| format!("IMAP 问候读取失败: {error}"))?;

    if imap_line_has_status(&greeting, "BYE") {
        return Err(format!(
            "IMAP 服务器拒绝连接: {}",
            String::from_utf8_lossy(&greeting).trim()
        ));
    }

    let mut tag_index = 1;
    run_imap_command(
        &mut stream,
        &mut tag_index,
        &format!(
            "LOGIN {} {}",
            quote_imap_string(MAIL_SENDER),
            quote_imap_string(&auth_code)
        ),
    )
    .map_err(|error| format!("IMAP 登录失败: {error}"))?;

    let identify_result = identify_imap_client(&mut stream, &mut tag_index);

    run_imap_command(&mut stream, &mut tag_index, "SELECT INBOX").map_err(|error| {
        if let Err(identify_error) = &identify_result {
            format!("打开收件箱失败: {error}；IMAP 客户端标识结果: {identify_error}")
        } else {
            format!("打开收件箱失败: {error}")
        }
    })?;

    let search_response = run_imap_command(&mut stream, &mut tag_index, "SEARCH ALL")
        .map_err(|error| format!("搜索收件箱失败: {error}"))?;
    let mut message_ids = parse_search_message_ids(&search_response);
    message_ids.sort_unstable();

    let mut inbox_items = Vec::new();
    for message_id in message_ids.into_iter().rev().take(MAIL_INBOX_LIMIT) {
        let fetch_response = run_imap_command(
            &mut stream,
            &mut tag_index,
            &format!("FETCH {message_id} BODY.PEEK[]"),
        )
        .map_err(|error| format!("读取邮件失败: {error}"))?;
        let Some(body) = first_imap_literal(&fetch_response) else {
            continue;
        };

        inbox_items.push(parse_inbox_item(message_id, body));
    }

    let _ = run_imap_command(&mut stream, &mut tag_index, "LOGOUT");
    Ok(inbox_items)
}

/// 网易系邮箱会在缺少 IMAP ID 客户端标识时拒绝后续 SELECT，表现为 UnsafeLogin。
fn identify_imap_client<T: Read + Write>(
    stream: &mut T,
    tag_index: &mut u32,
) -> Result<Vec<u8>, String> {
    run_imap_command(stream, tag_index, MAIL_IMAP_CLIENT_ID)
        .map_err(|error| format!("IMAP 客户端标识失败: {error}"))
}

/// 发送一条带标签的 IMAP 命令，读取到同标签的最终状态行为止。
fn run_imap_command<T: Read + Write>(
    stream: &mut T,
    tag_index: &mut u32,
    command: &str,
) -> Result<Vec<u8>, String> {
    let tag = format!("A{:04}", *tag_index);
    *tag_index += 1;

    stream
        .write_all(format!("{tag} {command}\r\n").as_bytes())
        .map_err(|error| format!("发送命令失败: {error}"))?;
    stream
        .flush()
        .map_err(|error| format!("刷新命令失败: {error}"))?;

    read_imap_response(stream, &tag)
}

/// 读取 IMAP 响应，支持 FETCH 这类携带 literal 数据块的响应。
fn read_imap_response<T: Read>(stream: &mut T, tag: &str) -> Result<Vec<u8>, String> {
    let mut response = Vec::new();

    loop {
        let line = read_imap_line(stream).map_err(|error| format!("读取响应失败: {error}"))?;
        let is_final_line = line.starts_with(tag.as_bytes()) && line.get(tag.len()) == Some(&b' ');
        let literal_len = imap_literal_len_from_line(&line);

        response.extend_from_slice(&line);

        if let Some(literal_len) = literal_len {
            let mut literal = vec![0; literal_len];
            stream
                .read_exact(&mut literal)
                .map_err(|error| format!("读取邮件内容失败: {error}"))?;
            response.extend_from_slice(&literal);
        }

        if is_final_line {
            if imap_line_has_status(&line, "OK") {
                return Ok(response);
            }

            return Err(String::from_utf8_lossy(&line).trim().to_string());
        }
    }
}

/// 逐字节读取一行，避免用 BufReader 包住 TLS 流后难以继续写命令。
fn read_imap_line<T: Read>(stream: &mut T) -> std::io::Result<Vec<u8>> {
    let mut line = Vec::new();
    let mut byte = [0];

    loop {
        stream.read_exact(&mut byte)?;
        line.push(byte[0]);
        if byte[0] == b'\n' {
            return Ok(line);
        }
    }
}

/// 判断一行 IMAP 响应是否包含指定状态。
fn imap_line_has_status(line: &[u8], status: &str) -> bool {
    let text = String::from_utf8_lossy(line);
    text.split_whitespace()
        .nth(1)
        .is_some_and(|value| value.eq_ignore_ascii_case(status))
}

/// 从响应行末尾的 `{123}` 中读取 literal 长度。
fn imap_literal_len_from_line(line: &[u8]) -> Option<usize> {
    let trimmed = line.strip_suffix(b"\r\n").unwrap_or(line);
    if !trimmed.ends_with(b"}") {
        return None;
    }

    let open_index = trimmed.iter().rposition(|byte| *byte == b'{')?;
    let literal = trimmed.get(open_index + 1..trimmed.len().checked_sub(1)?)?;
    let literal = literal.strip_suffix(b"+").unwrap_or(literal);
    std::str::from_utf8(literal).ok()?.parse().ok()
}

/// 提取 SEARCH 响应中的邮件序号。
fn parse_search_message_ids(response: &[u8]) -> Vec<u32> {
    String::from_utf8_lossy(response)
        .lines()
        .filter_map(|line| line.strip_prefix("* SEARCH"))
        .flat_map(|line| line.split_whitespace())
        .filter_map(|value| value.parse::<u32>().ok())
        .collect()
}

/// 提取 FETCH 响应中的第一段 literal，作为邮件原文。
fn first_imap_literal(response: &[u8]) -> Option<&[u8]> {
    let mut index = 0;

    while let Some(open_relative) = response.get(index..)?.iter().position(|byte| *byte == b'{') {
        let open_index = index + open_relative;
        let close_relative = response.get(open_index..)?.iter().position(|byte| *byte == b'}')?;
        let close_index = open_index + close_relative;

        if response.get(close_index + 1..close_index + 3) != Some(b"\r\n") {
            index = close_index + 1;
            continue;
        }

        let literal = response.get(open_index + 1..close_index)?;
        let literal = literal.strip_suffix(b"+").unwrap_or(literal);
        let Ok(literal_len) = std::str::from_utf8(literal).ok()?.parse::<usize>() else {
            index = close_index + 1;
            continue;
        };

        let literal_start = close_index + 3;
        let literal_end = literal_start.checked_add(literal_len)?;
        return response.get(literal_start..literal_end);
    }

    None
}

/// 按 IMAP quoted string 规则转义登录用户名和授权码。
fn quote_imap_string(value: &str) -> String {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

/// 从原始邮件内容中提取列表展示所需字段。
fn parse_inbox_item(message_id: u32, body: &[u8]) -> MailInboxItem {
    match mailparse::parse_mail(body) {
        Ok(parsed) => {
            let subject = parsed
                .headers
                .get_first_value("Subject")
                .unwrap_or_else(|| "无主题".to_string());
            let from = parsed
                .headers
                .get_first_value("From")
                .unwrap_or_else(|| "未知发件人".to_string());
            let date = parsed.headers.get_first_value("Date").unwrap_or_default();
            let body = extract_mail_body(&parsed);
            let preview = normalize_mail_preview(&body);

            MailInboxItem {
                id: message_id.to_string(),
                from,
                subject,
                date,
                preview,
                body,
            }
        }
        Err(error) => MailInboxItem {
            id: message_id.to_string(),
            from: "解析失败".to_string(),
            subject: "邮件解析失败".to_string(),
            date: String::new(),
            preview: error.to_string(),
            body: error.to_string(),
        },
    }
}

/// 递归提取完整邮件正文，优先使用 text/plain。
fn extract_mail_body(parsed: &mailparse::ParsedMail<'_>) -> String {
    if parsed.subparts.is_empty() {
        return normalize_mail_body(parsed.get_body().unwrap_or_default(), &parsed.ctype.mimetype);
    }

    if let Some(text_part) = parsed
        .subparts
        .iter()
        .find(|part| part.ctype.mimetype.eq_ignore_ascii_case("text/plain"))
    {
        return normalize_mail_body(
            text_part.get_body().unwrap_or_default(),
            &text_part.ctype.mimetype,
        );
    }

    for part in &parsed.subparts {
        let body = extract_mail_body(part);
        if !body.is_empty() {
            return body;
        }
    }

    String::new()
}

/// 清理完整正文的换行和 HTML 标签，但不截断正文。
fn normalize_mail_body(value: String, mime_type: &str) -> String {
    let normalized = value.replace("\r\n", "\n").replace('\r', "\n");
    let body = if mime_type.eq_ignore_ascii_case("text/html") {
        strip_html_tags(&normalized)
    } else {
        normalized
    };

    body.lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

/// 清理邮件正文中的连续空白并截断为适合小面板展示的摘要。
fn normalize_mail_preview(value: &str) -> String {
    let compact = value.split_whitespace().collect::<Vec<_>>().join(" ");
    compact.chars().take(120).collect()
}

/// 在没有 text/plain 时，把 HTML 正文转成可读文本兜底。
fn strip_html_tags(value: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;

    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                output.push(' ');
            }
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }

    output
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

/// 读取前端邮件面板随命令传入的授权码。
fn read_mail_auth_code(config: &MailConfigPayload) -> Result<String, String> {
    let auth_code = config.auth_code.trim();
    if auth_code.is_empty() {
        return Err("请先在邮件面板填写 163 邮箱授权码".to_string());
    }

    Ok(auth_code.to_string())
}

fn read_mail_smtp_host(config: &MailConfigPayload) -> String {
    config
        .smtp_host
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(MAIL_DEFAULT_SMTP_HOST)
        .to_string()
}

fn read_mail_imap_host(config: &MailConfigPayload) -> String {
    config
        .imap_host
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(MAIL_DEFAULT_IMAP_HOST)
        .to_string()
}

/// 切换主窗口显示状态，供托盘菜单和前端命令复用。
fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            _ => {
                // 从托盘唤醒时同时聚焦，避免窗口显示但停在后台。
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}

/// 创建系统托盘和托盘菜单事件。
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "唤醒/隐藏宠物", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出宠物", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &quit])?;

    // 托盘图标使用 icon.gif 首帧生成的 PNG；原始 GIF 保存在 icons/tray-icon-source.gif。
    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;

    TrayIconBuilder::new()
        .tooltip("月薪喵")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

/// 初始化 Tauri 应用、注册插件/命令并启动主循环。
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            toggle_pet_window,
            quit_app,
            send_mail,
            fetch_mail_inbox,
            fetch_juhe_news
        ])
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("运行月薪喵失败");
}

