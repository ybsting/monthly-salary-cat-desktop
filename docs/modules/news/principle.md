# 新闻模块原理文档

## 核心思路

新闻功能采用“面板交互 + Tauri 后端代理”的结构。`SalaryCat.vue` 负责右键入口、配置保存、刷新按钮和展示结果；`newsHelper.ts` 负责调用后端代理并把聚合数据字段统一成 `NewsItem`；`src-tauri/src/lib.rs` 负责实际访问聚合数据接口。

## 请求流程

1. 用户右键打开菜单，点击“新闻”。
2. `openNewsPanel()`（`src/components/SalaryCat.vue`）关闭其他面板，显示新闻面板。
3. 如果当前没有新闻条目，组件调用 `refreshNewsResult()`（`src/components/SalaryCat.vue`）尝试刷新。
4. `refreshNewsResult()`（`src/components/SalaryCat.vue`）将状态设为 `loading`，并把当前配置传给 `getTodayNews()`（`src/news/newsHelper.ts`）。
5. `getTodayNews()`（`src/news/newsHelper.ts`）调用聚合数据请求函数。
6. 请求成功时返回聚合数据接口给出的全部新闻条目；请求失败或缺少 Key 时返回错误状态和原因。

## 请求策略

当前仅保留聚合数据来源，适合中文当日新闻；支持头条、国内、国际、财经、科技、娱乐、体育分类。

聚合数据需要用户自行填写 API Key。组件会把 Key 和分类保存在 localStorage，避免每次打开都要重新填写。

前端 WebView 直接 `fetch` 聚合数据时可能被 CORS 或 WebView 网络策略拦截，表现为 `Failed to fetch`。因此 Tauri 环境下 `requestJuheNews()`（`src/news/newsHelper.ts`）使用 `@tauri-apps/api/core` 的 `invoke()` 调用 Rust 命令 `fetch_juhe_news`（`src-tauri/src/lib.rs`），由 Rust 侧 `reqwest` 发起 HTTP 请求，再把 JSON 结果返回给前端。普通浏览器预览环境保留直接 `fetch` 回退，仅用于开发调试。

## 展示原则

新闻面板只展示标题、来源、时间、摘要和原文链接，不抓取全文，不缓存历史新闻。这样初版范围更小，也能避免引入正文解析、版权和持久化复杂度。

新闻标题点击时不会依赖 WebView 的普通 `<a target="_blank">` 行为，而是由 `openNewsUrl()`（`src/components/SalaryCat.vue`）通过 `plugin:opener|open_url` 显式调用系统默认浏览器。Tauri 权限中需要开启 `opener:default`，否则点击标题可能没有响应。

## 并发与错误处理

新闻刷新可能因为网络延迟乱序返回。组件用 `lastNewsRequestId` 标记最新请求，只有最新请求可以写回 `newsResult`。

缺少 Key、接口限流、网络错误或聚合数据返回错误时，helper 会把错误转换为面板消息，不使用假新闻兜底。
