# Tauri 桌面壳模块实现文档

## 文件范围

| 文件 | 职责 |
| --- | --- |
| `src-tauri/src/main.rs` | Rust 二进制入口；release 模式设置 `windows_subsystem = "windows"`，双击运行时不显示后端命令框窗口 |
| `src-tauri/src/lib.rs` | Tauri Builder、命令注册、单实例插件、托盘、新闻代理、邮件 SMTP/IMAP |
| `src-tauri/tauri.conf.json` | 窗口、构建和打包配置 |
| `src-tauri/icons/*` | 托盘图标和打包图标资源 |
| `scripts/tauri-build.cmd` | Windows 构建脚本，自动探测 VS Build Tools 并运行 `npx tauri build` |

## 命令

- `toggle_pet_window(app)`：切换主窗口显示/隐藏。
- `quit_app(app)`：退出应用。
- `send_mail(payload)`：接收前端传来的邮件内容和 `MailConfigPayload`，通过 SMTP 发送。
- `fetch_mail_inbox(config)`：接收前端传来的 `MailConfigPayload`，通过 IMAP 读取最近邮件。
- `fetch_juhe_news(key, category)`：代理聚合数据新闻请求。

## 单实例

`run()` 在 `tauri::Builder::default()` 后第一个注册 `tauri_plugin_single_instance::init()`，再注册 `tauri_plugin_opener::init()` 和命令处理器。单实例插件必须先于其他插件注册，确保重复启动事件先被拦截。

当用户再次双击月薪喵时，新进程不会启动第二个实例，而是通知已有实例执行：

- `window.unminimize()`
- `window.show()`
- `window.set_focus()`

这样一台主机同时只保留一个月薪喵进程，重复启动会唤醒已经运行的主窗口。

## 图标

托盘图标由 `src-tauri/src/lib.rs` 使用：

```rust
Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
```

打包图标由 `src-tauri/tauri.conf.json` 的 `bundle.icon` 指向：

- `icons/32x32.png`
- `icons/64x64.png`
- `icons/128x128.png`
- `icons/128x128@2x.png`
- `icons/icon.ico`

这些文件已由 `icons/tray-icon.png` 重新生成。`64x64.png` 与托盘 PNG 完全同源，`icon.ico` 覆盖 16、24、32、48、64、128、256 像素尺寸，使安装包图标、exe 图标和托盘图标保持一致，并覆盖 Windows 安装器、开始菜单、资源管理器和高 DPI 缩放场景。

## 邮件后端边界

Rust 后端不再读取邮箱授权码环境变量或 `mail.local.json`。`MailConfigPayload` 由前端每次调用传入，`read_mail_auth_code()`、`read_mail_smtp_host()`、`read_mail_imap_host()` 只解析该 payload 和默认主机。
