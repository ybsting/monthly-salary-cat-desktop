# 翻译模块原理文档

## 核心思路

翻译模块采用“离线词典兜底 + 可选在线 provider”的结构。用户从月薪喵右键菜单进入翻译模式后，在面板中输入中文或英文；默认规则是英文转中文、中文转英文。在线不可用或选择本地 provider 时展示本地词典结果。

## 本地兜底原理

本地兜底基于 npm 包 `cedict-json`，数据来源是 CC-CEDICT。它不是离线机器翻译模型，而是一个较大的中英词典数据集。

为了避免拖慢月薪喵启动，词典不会随主应用同步加载。`getOfflineDictionary()`（`src/translation/translationHelper.ts`）会在第一次需要本地翻译时动态导入 `cedict-json`，然后建立两个内存索引并缓存：

1. 中文索引：用简体和繁体词条精确匹配输入，返回词条、拼音和英文释义，作为中文转英文的本地结果。
2. 英文反向索引：从 CC-CEDICT 的英文释义中提取英文词或短语，反向映射到候选中文词条。

少量常见口语短语仍保留在 `fallbackPhraseDictionary` 中，例如 `good morning`、`thank you`。这是对 CC-CEDICT 词条型数据的体验补充，不再是主要本地词典来源。

`getLocalTranslation()`（`src/translation/translationHelper.ts`）会先判断输入是否包含中文或英文。纯中文走中文词条到英文释义，纯英文先查短语补充，再查英文反向索引；多词英文短句会逐词返回候选中文词条。混合文本仍建议使用在线翻译。

## 在线 provider 原理

面板中的 provider 下拉框支持本地、百度、Azure、MyMemory 和 DeepL。配置字段保存在浏览器/WebView 的 `localStorage` 中，避免每次打开面板都重新输入。

在线请求由 `getTranslationResult()`（`src/translation/translationHelper.ts`）控制：

1. 如果选择本地 provider，直接加载离线词典并返回本地结果。
2. 如果选择在线 provider，则优先调用 `translateOnline()`（`src/translation/translationHelper.ts`）分发到具体实现，避免在线成功时加载大体积离线词典。
3. 在线 provider 会根据输入自动选择目标语言：中文输入转英文，非中文英文输入转中文。
4. 在线成功时，展示在线结果。
5. 在线失败、未配置密钥、网络错误或接口返回错误时，再加载离线词典，第一行展示失败原因，后续展示本地兜底。

## Provider 配置

- 百度翻译需要 App ID 和密钥。请求前使用内置 `md5()`（`src/translation/translationHelper.ts`）生成百度签名。
- Azure Translator 需要订阅密钥，部分资源还需要区域。
- MyMemory 当前不需要密钥，适合轻量试用。
- DeepL 使用 API Free 地址，需要 DeepL API Key。

这些密钥目前保存在本地 `localStorage`。它适合个人桌面应用快速使用；如果后续要分发给他人或提高密钥保护等级，应迁移到 Tauri 后端安全存储或系统凭据管理。

当前第一版由前端/WebView 直接请求在线 provider。若某个服务因为 CORS、网络或账号限制拒绝请求，界面会展示失败原因并回落到本地结果；后续要提升在线翻译稳定性时，应把请求迁移到 Tauri 后端代理。

## 构建与性能

`cedict-json` 是大体积离线词典。Vite 会把它拆成单独的动态 chunk，因此生产构建会出现大 chunk 提示。这是可预期的：主应用包保持较小，只有用户第一次使用本地翻译时才加载离线词典。

## 交互原理

`SalaryCat.vue` 监听右键并展示菜单。点击“翻译”后由 `openTranslationPanel()`（`src/components/SalaryCat.vue`）关闭菜单、关闭阅读面板、打开翻译面板，并在下一个 DOM 更新周期聚焦输入框。

翻译面板监听输入内容、provider 和密钥配置变化。任一变化都会保存配置并刷新结果。由于在线请求可能乱序返回，组件用 `lastTranslationRequestId` 记录最新请求，只允许最新请求写回 `translationResult`。

按 `Esc` 会关闭右键菜单、阅读面板和翻译面板。翻译面板打开时，点击宠物不会弹出语录，避免气泡遮挡输入。
