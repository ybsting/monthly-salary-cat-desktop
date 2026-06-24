# 翻译模块实现文档

## 模块范围

| 文件 | 职责 |
| --- | --- |
| `src/translation/translationHelper.ts` | 识别输入文本类型，懒加载 `cedict-json` 离线词典，返回英文转中文、中文转英文或在线翻译结果，并在在线失败时回落到本地结果 |
| `src/components/SalaryCat.vue` | 提供右键翻译入口、翻译输入面板、在线提供商选择、密钥输入、状态展示和本地存储 |
| `src/styles.css` | 复用阅读面板样式，并提供翻译面板 provider 选择和配置输入样式 |

## 实现清单

| 名称 | 类型 | 文件 | 行号 | 说明 |
| --- | --- | --- | --- | --- |
| `CedictEntry` | 类型导入 | `src/translation/translationHelper.ts` | 1 | `cedict-json` 离线词典条目类型 |
| `TranslationProvider` | 类型别名 | `src/translation/translationHelper.ts` | 3 | 标识翻译提供商：本地、百度、Azure、MyMemory、DeepL |
| `TranslationKind` | 类型别名 | `src/translation/translationHelper.ts` | 5 | 标识翻译结果类型：空、中文、英文、混合、错误 |
| `TranslationSettings` | 接口 | `src/translation/translationHelper.ts` | 7 | 保存在线 provider 和各 provider 密钥配置 |
| `TranslationResult` | 接口 | `src/translation/translationHelper.ts` | 16 | 翻译结果结构，包含类型、原文和展示行 |
| `OfflineDictionary` | 接口 | `src/translation/translationHelper.ts` | 37 | 保存离线中文索引和英文反向索引 |
| `fallbackPhraseDictionary` | 常量 | `src/translation/translationHelper.ts` | 42 | 少量常见英文短语补充，用于 CC-CEDICT 不擅长的口语短句 |
| `getTranslationResult(input, settings)` | 异步函数 | `src/translation/translationHelper.ts` | 52 | 生成双向翻译结果；在线 provider 失败时附带本地兜底 |
| `getTranslationKind(source)` | 函数 | `src/translation/translationHelper.ts` | 99 | 根据输入内容判断翻译结果类型 |
| `getLocalTranslation(source)` | 异步函数 | `src/translation/translationHelper.ts` | 110 | 判断中文、英文或混合文本，并分发到本地双向词典翻译 |
| `getOfflineDictionary()` | 异步函数 | `src/translation/translationHelper.ts` | 136 | 动态导入 `cedict-json`，并缓存中文和英文索引 |
| `getChineseExplanation(source, dictionary)` | 函数 | `src/translation/translationHelper.ts` | 153 | 根据 CC-CEDICT 中文词条返回拼音和英文释义，作为中文转英文的本地结果 |
| `getEnglishTranslation(source, dictionary)` | 函数 | `src/translation/translationHelper.ts` | 164 | 根据英文释义反向索引返回候选中文词条 |
| `buildChineseEntryMap(entries)` | 函数 | `src/translation/translationHelper.ts` | 197 | 建立简体/繁体中文精确查询索引 |
| `buildEnglishEntryMap(entries)` | 函数 | `src/translation/translationHelper.ts` | 209 | 从英文释义中提取短语，建立英译中反向索引 |
| `addEntry(map, key, entry)` | 函数 | `src/translation/translationHelper.ts` | 223 | 归一化词条 key，并补充简单复数回退 |
| `addSingleEntry(map, key, entry)` | 函数 | `src/translation/translationHelper.ts` | 239 | 将词条加入索引并限制单 key 候选数量 |
| `extractEnglishTerms(definition)` | 函数 | `src/translation/translationHelper.ts` | 249 | 从 CC-CEDICT 英文释义中提取可匹配短语 |
| `formatChineseEntry(entry)` | 函数 | `src/translation/translationHelper.ts` | 264 | 格式化中文词条结果 |
| `formatEnglishMatches(word, matches)` | 函数 | `src/translation/translationHelper.ts` | 269 | 格式化英文反查结果 |
| `translateOnline(source, settings)` | 异步函数 | `src/translation/translationHelper.ts` | 274 | 根据 provider 分发到具体在线翻译实现 |
| `translateWithBaidu(source, settings)` | 异步函数 | `src/translation/translationHelper.ts` | 285 | 调用百度翻译 API，中文输入目标语言为英文，英文输入目标语言为中文 |
| `translateWithAzure(source, settings)` | 异步函数 | `src/translation/translationHelper.ts` | 317 | 调用 Azure Translator API，中文输入目标语言为英文，英文输入目标语言为简体中文 |
| `translateWithMyMemory(source)` | 异步函数 | `src/translation/translationHelper.ts` | 342 | 调用 MyMemory 免费翻译接口，按输入语言切换 `langpair` |
| `translateWithDeepL(source, settings)` | 异步函数 | `src/translation/translationHelper.ts` | 356 | 调用 DeepL API Free 接口，中文输入目标语言为英文，英文输入目标语言为中文 |
| `md5(input)` | 函数 | `src/translation/translationHelper.ts` | 384 | 为百度翻译签名生成 MD5 |
| `stringToWords(input)` | 函数 | `src/translation/translationHelper.ts` | 479 | 将 UTF-8 字符串转换为 MD5 计算所需字数组 |
| `wordToHex(value)` | 函数 | `src/translation/translationHelper.ts` | 498 | 将 MD5 内部字转换为十六进制字符串 |
| `isTranslationPanelVisible` | 响应式状态 | `src/components/SalaryCat.vue` | 43 | 控制翻译面板显隐 |
| `translationInput` | 响应式状态 | `src/components/SalaryCat.vue` | 48 | 翻译面板输入内容 |
| `translationStatus` | 响应式状态 | `src/components/SalaryCat.vue` | 49 | 展示在线翻译请求状态 |
| `translationProvider` | 响应式状态 | `src/components/SalaryCat.vue` | 62 | 当前翻译提供商，持久化到 localStorage |
| `baiduAppId` / `baiduKey` | 响应式状态 | `src/components/SalaryCat.vue` | 63, 64 | 百度翻译 API 配置 |
| `azureKey` / `azureRegion` | 响应式状态 | `src/components/SalaryCat.vue` | 65, 66 | Azure Translator API 配置 |
| `deeplKey` | 响应式状态 | `src/components/SalaryCat.vue` | 67 | DeepL API Key 配置 |
| `translationResult` | 响应式状态 | `src/components/SalaryCat.vue` | 71 | 当前翻译结果 |
| `translationInputElement` | 模板引用 | `src/components/SalaryCat.vue` | 86 | 翻译面板打开后自动聚焦输入框 |
| `translationSettings` | 计算属性 | `src/components/SalaryCat.vue` | 99 | 汇总当前 provider 和密钥配置 |
| `readStoredValue(key, fallback)` | 函数 | `src/components/SalaryCat.vue` | 115 | 读取 localStorage 中的翻译配置 |
| `saveStoredValue(key, value)` | 函数 | `src/components/SalaryCat.vue` | 124 | 保存翻译配置到 localStorage |
| `openTranslationPanel()` | 异步函数 | `src/components/SalaryCat.vue` | 316 | 从菜单进入翻译模式，打开面板并聚焦 |
| `closeTranslationPanel()` | 函数 | `src/components/SalaryCat.vue` | 331 | 关闭翻译面板并清空输入和状态 |
| `refreshTranslationResult()` | 异步函数 | `src/components/SalaryCat.vue` | 679 | 根据当前输入和配置刷新翻译结果，并丢弃过期请求 |
| `lastTranslationRequestId` | 变量 | `src/components/SalaryCat.vue` | 756 | 标记最新翻译请求，避免旧请求覆盖新结果 |
| `watch([...])` | 监听器 | `src/components/SalaryCat.vue` | 759 | 监听输入、provider 和密钥变化，保存配置并刷新结果 |
| `.translation-panel` | 样式规则 | `src/styles.css` | 155 | 调整翻译面板顶部位置 |
| `.translation-panel__settings` | 样式规则 | `src/styles.css` | 232 | 定义 provider 与配置输入区布局 |
| `.translation-panel__select` | 样式规则 | `src/styles.css` | 240 | 定义 provider 下拉框样式 |
| `.translation-panel__config` | 样式规则 | `src/styles.css` | 241 | 定义在线 provider 密钥输入框样式 |
| `.reading-panel__result` 可复制规则 | 样式规则 | `src/styles.css` | 620 | 覆盖全局禁止选择，让翻译结果可以复制 |

## 外部依赖与接口

- `cedict-json`：CC-CEDICT JSON 离线词典数据，用于本地中文转英文词条释义和英文释义反查中文。
- 百度翻译：`https://fanyi-api.baidu.com/api/trans/vip/translate`
- Azure Translator：`https://api.cognitive.microsofttranslator.com/translate`
- MyMemory：`https://api.mymemory.translated.net/get`
- DeepL API Free：`https://api-free.deepl.com/v2/translate`

## 构建影响

`cedict-json` 数据约 16MB。当前通过动态导入懒加载到单独 chunk，主应用包不直接包含完整词典；第一次使用本地翻译时会加载该离线词典 chunk，后续由浏览器/WebView 缓存。

## 修改时必须同步的文档

- 修改翻译结果结构、离线词典索引、provider、签名算法、API 参数或兜底策略：更新本文档和 [原理文档](./principle.md)。
- 修改翻译面板交互、状态、模板或样式：同步更新 [前端宠物模块实现文档](../frontend-pet/implementation.md) 和 [前端宠物模块原理文档](../frontend-pet/principle.md)。
- 修改模块边界或依赖：同步更新 [项目总览](../../overview.md)。
