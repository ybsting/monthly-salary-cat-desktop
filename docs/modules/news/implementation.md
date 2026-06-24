# 新闻模块实现文档

## 模块范围

| 文件 | 职责 |
| --- | --- |
| `src/news/newsHelper.ts` | 调用 Tauri 后端代理请求聚合数据，并统一格式化为新闻列表 |
| `src/components/SalaryCat.vue` | 提供右键新闻入口、新闻面板、聚合数据 Key 输入、分类选择、本地存储和刷新逻辑 |
| `src/styles.css` | 提供新闻面板、刷新按钮、状态条和新闻列表样式 |
| `src-tauri/src/lib.rs` | 提供 `fetch_juhe_news` 后端代理命令，避免前端 WebView 直连聚合数据时被 CORS 拦截 |
| `src-tauri/Cargo.toml` | 声明 `reqwest` 依赖，用于 Rust 侧发起 HTTP 请求 |

## 实现清单

| 名称 | 类型 | 文件 | 行号 | 说明 |
| --- | --- | --- | --- | --- |
| `invoke` | 函数导入 | `src/news/newsHelper.ts` | 1 | 调用 Tauri 后端代理命令 |
| `NewsProvider` | 类型别名 | `src/news/newsHelper.ts` | 3 | 标识新闻来源，当前仅支持聚合数据 |
| `NewsSettings` | 接口 | `src/news/newsHelper.ts` | 5 | 保存新闻 provider、聚合数据 API Key 和分类配置 |
| `NewsItem` | 接口 | `src/news/newsHelper.ts` | 11 | 统一后的新闻条目结构，包含标题、来源、时间、摘要和链接 |
| `NewsResult` | 接口 | `src/news/newsHelper.ts` | 20 | 新闻请求结果结构，包含状态、消息和条目列表 |
| `getTodayNews(settings)` | 异步函数 | `src/news/newsHelper.ts` | 27 | 获取当日新闻，并统一返回空、成功或错误状态 |
| `fetchJuheNews(settings)` | 异步函数 | `src/news/newsHelper.ts` | 54 | 调用聚合数据新闻头条接口，并把接口返回的全部条目映射为 `NewsItem[]` |
| `requestJuheNews(key, category)` | 异步函数 | `src/news/newsHelper.ts` | 79 | Tauri 环境通过 `fetch_juhe_news` 代理请求；浏览器预览环境保留直接 fetch 回退 |
| `isTauriRuntime()` | 函数 | `src/news/newsHelper.ts` | 100 | 判断当前是否运行在 Tauri 环境 |
| `JuheNewsItem` | 接口 | `src/news/newsHelper.ts` | 104 | 描述聚合数据新闻条目字段 |
| `JuheNewsResponse` | 接口 | `src/news/newsHelper.ts` | 113 | 描述聚合数据响应结构 |
| `isNewsPanelVisible` | 响应式状态 | `src/components/SalaryCat.vue` | 44 | 控制新闻面板显隐 |
| `newsProvider` | 响应式状态 | `src/components/SalaryCat.vue` | 68 | 当前新闻 provider，持久化到 localStorage |
| `juheNewsKey` / `juheNewsCategory` | 响应式状态 | `src/components/SalaryCat.vue` | 69, 70 | 聚合数据新闻 API Key 和分类 |
| `newsResult` | 响应式状态 | `src/components/SalaryCat.vue` | 78 | 当前新闻请求状态和新闻列表 |
| `newsSettings` | 计算属性 | `src/components/SalaryCat.vue` | 108 | 汇总当前新闻 provider、Key 和分类 |
| `openNewsPanel()` | 异步函数 | `src/components/SalaryCat.vue` | 338 | 从右键菜单进入新闻面板，并在首次打开时尝试刷新 |
| `closeNewsPanel()` | 函数 | `src/components/SalaryCat.vue` | 353 | 关闭新闻面板 |
| `refreshNewsResult()` | 异步函数 | `src/components/SalaryCat.vue` | 643 | 请求今日新闻，并用请求 id 避免旧结果覆盖新结果 |
| `openNewsUrl(url)` | 异步函数 | `src/components/SalaryCat.vue` | 662 | 点击新闻标题时通过 Tauri opener 打开系统默认浏览器，浏览器预览环境回退到 `window.open` |
| `lastNewsRequestId` | 变量 | `src/components/SalaryCat.vue` | 757 | 标记最新新闻请求 |
| `watch([...news])` | 监听器 | `src/components/SalaryCat.vue` | 773 | 保存新闻 provider、Key 和分类配置 |
| `fetch_juhe_news(key, category)` | Tauri 命令 | `src-tauri/src/lib.rs` | 92 | 使用 `reqwest` 请求聚合数据并把 JSON 返回给前端 |
| `tauri::generate_handler![..., fetch_juhe_news]` | 命令注册 | `src-tauri/src/lib.rs` | 413 | 将新闻代理命令注册为可 invoke 命令 |
| `reqwest` | Rust 依赖 | `src-tauri/Cargo.toml` | 20 | Rust 侧 HTTP 客户端 |
| `opener:default` | Tauri 权限 | `src-tauri/capabilities/default.json` | 12 | 允许新闻标题通过 opener 插件打开 `http/https` 链接 |
| `.news-panel` | 样式规则 | `src/styles.css` | 159 | 调整新闻面板顶部位置 |
| `.news-panel__refresh` | 样式规则 | `src/styles.css` | 335 | 定义刷新按钮样式 |
| `.news-panel__status` | 样式规则 | `src/styles.css` | 356 | 定义新闻状态提示样式 |
| `.news-panel__list` | 样式规则 | `src/styles.css` | 380 | 定义新闻列表弹性滚动区域，避免面板下端被窗口裁掉 |
| `.news-panel__item` | 样式规则 | `src/styles.css` | 390 | 定义单条新闻容器样式 |
| `.news-panel__title` | 样式规则 | `src/styles.css` | 396 | 定义新闻标题链接样式 |
| `.news-panel__meta` / `.news-panel__summary` | 样式规则 | `src/styles.css` | 412, 413 | 定义来源时间和摘要样式 |
| `.news-panel__status` / `.news-panel__item` 可复制规则 | 样式规则 | `src/styles.css` | 620 | 覆盖全局禁止选择，让新闻状态和新闻内容可以复制 |

## 外部接口

- 聚合数据新闻头条：`https://v.juhe.cn/toutiao/index`

## 修改时必须同步的文档

- 修改新闻 provider、接口参数、返回结构或错误处理：更新本文档和 [原理文档](./principle.md)。
- 修改新闻面板交互、状态、模板或样式：同步更新 [前端宠物模块实现文档](../frontend-pet/implementation.md) 和 [前端宠物模块原理文档](../frontend-pet/principle.md)。
- 修改模块边界或依赖：同步更新 [项目总览](../../overview.md)。
