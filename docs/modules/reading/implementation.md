# 阅读模块实现文档

## 模块范围

| 文件 | 职责 |
| --- | --- |
| `src/reading/readingHelper.ts` | 识别输入文本类型，生成中文默认拼音、多音字候选、英文精确音标或英文自然拼读近似音标 |
| `src/components/SalaryCat.vue` | 提供右键菜单、阅读输入面板、结果展示和语音播放 |
| `src/styles.css` | 提供右键菜单、阅读/翻译共用面板和播放按钮样式 |

## 实现清单

| 名称 | 类型 | 文件 | 行号 | 说明 |
| --- | --- | --- | --- | --- |
| `ReadingKind` | 类型别名 | `src/reading/readingHelper.ts` | 3 | 标识阅读结果类型：空、中文、英文、混合 |
| `ReadingResult` | 接口 | `src/reading/readingHelper.ts` | 5 | 阅读结果结构，包含类型、原文和展示行 |
| `phoneticDictionary` | 常量 | `src/reading/readingHelper.ts` | 11 | 内置常见词和不规则词音标，用于优先返回较准确结果 |
| `longVowels` | 常量 | `src/reading/readingHelper.ts` | 116 | 自然拼读长元音映射 |
| `shortVowels` | 常量 | `src/reading/readingHelper.ts` | 124 | 自然拼读短元音映射 |
| `phonicsPatterns` | 常量 | `src/reading/readingHelper.ts` | 133 | 自然拼读字母组合规则 |
| `getReadingResult(input)` | 函数 | `src/reading/readingHelper.ts` | 167 | 根据输入内容返回拼音、音标或提示 |
| `getChineseLines(source, label)` | 函数 | `src/reading/readingHelper.ts` | 205 | 生成中文默认拼音，并为多音字追加全部候选读音 |
| `getEnglishLines(source)` | 函数 | `src/reading/readingHelper.ts` | 221 | 提取英文单词，优先查词典，未命中时返回自然拼读近似 |
| `buildPhonicsPronunciation(word)` | 函数 | `src/reading/readingHelper.ts` | 242 | 根据自然拼读规则为任意英文单词生成近似音标 |
| `getLongVowelSound(word, index, hasSilentFinalE)` | 函数 | `src/reading/readingHelper.ts` | 273 | 处理静音 `e` 引发的长元音读法 |
| `letterToSound(letter, nextLetter, isFirstLetter)` | 函数 | `src/reading/readingHelper.ts` | 291 | 将单个字母映射为近似读音 |
| `isVowel(letter)` | 函数 | `src/reading/readingHelper.ts` | 304 | 判断字母是否按元音处理 |
| `readingInput` | 响应式状态 | `src/components/SalaryCat.vue` | 46 | 阅读面板输入内容 |
| `speechStatus` | 响应式状态 | `src/components/SalaryCat.vue` | 47 | 展示语音播放状态或错误提示 |
| `readingInputElement` | 模板引用 | `src/components/SalaryCat.vue` | 85 | 阅读面板打开后自动聚焦输入框 |
| `readingResult` | 计算属性 | `src/components/SalaryCat.vue` | 95 | 将输入内容转换为阅读结果 |
| `openReadingPanel()` | 异步函数 | `src/components/SalaryCat.vue` | 295 | 关闭右键菜单和其他工具面板，打开阅读面板并聚焦输入框 |
| `closeReadingPanel()` | 函数 | `src/components/SalaryCat.vue` | 308 | 停止语音播放，关闭阅读面板并清空输入 |
| `playReadingSpeech()` | 函数 | `src/components/SalaryCat.vue` | 701 | 使用 Web Speech API 播放当前输入文本的读音 |
| `stopReadingSpeech()` | 函数 | `src/components/SalaryCat.vue` | 734 | 取消当前语音播放 |
| `handleKeydown(event)` | 函数 | `src/components/SalaryCat.vue` | 746 | 按 `Esc` 时关闭菜单和工具面板 |
| `.reading-panel` | 样式规则 | `src/styles.css` | 136 | 阅读面板容器样式 |
| `.reading-panel__input` | 样式规则 | `src/styles.css` | 213 | 阅读输入框样式 |
| `.reading-panel__result` | 样式规则 | `src/styles.css` | 267 | 阅读结果区域样式，内容过多时在结果区内部滚动 |
| `.reading-panel__play` | 样式规则 | `src/styles.css` | 296 | 阅读结果框内小喇叭播放按钮样式 |
| `.reading-panel__speech-status` | 样式规则 | `src/styles.css` | 331 | 播放状态提示样式 |
| `.reading-panel__result` 可复制规则 | 样式规则 | `src/styles.css` | 620 | 覆盖全局禁止选择，让阅读结果可以复制 |

## 依赖

- `pinyin-pro`：用于中文文本转拼音；其中 `pinyin()` 生成上下文默认拼音，`polyphonic()` 获取每个汉字的多音字候选。
- 内置英文音标词典：用于离线返回常见词和不规则词的较准确音标。
- 自然拼读规则：用于词典未命中时返回近似音标。
- Web Speech API：用于播放当前输入文本读音，语音质量和可用语言由系统/WebView 决定。

## 当前能力边界

- 中文：支持中文文本转带声调拼音，并额外列出多音字的全部候选读音。
- 中文播放：使用 `zh-CN` 语音播放原文；实际读音由系统语音合成决定。
- 英文常见词/不规则词：优先返回内置精确音标，并使用 `en-US` 语音播放原文。
- 英文未收录词：返回自然拼读近似音标，并标注“自然拼读近似”。
- 混合文本：同时输出整段中文拼音、多音字候选和英文单词音标，播放时按 `zh-CN` 朗读原文。
- 如果当前环境不支持 Web Speech API，会显示“不支持语音播放”的提示。

## 修改时必须同步的文档

- 修改输入识别规则、结果结构、拼音/多音字逻辑、词典内容、自然拼读规则、语音播放逻辑或依赖：更新本文档。
- 修改阅读面板交互或样式：同步更新 [前端宠物模块实现文档](../frontend-pet/implementation.md)。
- 修改阅读能力的产品行为：同步更新 [原理文档](./principle.md)。
