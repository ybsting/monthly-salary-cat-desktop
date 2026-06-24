# 阅读模块原理文档

## 核心思路

阅读模块采用本地优先方案。用户从月薪喵右键菜单进入阅读模式，在输入框中输入中文或英文，前端即时计算并显示拼音或音标；播放按钮使用系统/WebView 提供的语音合成能力朗读输入原文。

## 输入识别原理

`getReadingResult()`（`src/reading/readingHelper.ts`）会先清理输入两侧空白，再用字符范围判断内容类型：

- 包含中文且不包含英文：按中文处理。
- 包含英文且不包含中文：按英文处理。
- 同时包含中文和英文：按混合文本处理。
- 空输入：显示功能提示。

中文判断使用 CJK 范围 `\u3400-\u9fff`，英文判断使用 `[a-z]`。

## 中文拼音原理

中文不是调用在线词典，也不访问外部接口。当前使用本地 npm 包 `pinyin-pro` 完成拼音处理：

1. `pinyin(source, { toneType: 'symbol', type: 'array' })` 是 npm 包 `pinyin-pro` 的外部方法，由 `src/reading/readingHelper.ts` 调用，根据上下文生成默认拼音。
2. `polyphonic(source, { toneType: 'symbol', type: 'array' })` 是 npm 包 `pinyin-pro` 的外部方法，由 `src/reading/readingHelper.ts` 调用，获取每个汉字的候选读音。
3. `getChineseLines()`（`src/reading/readingHelper.ts`）会先展示默认拼音；如果某个汉字候选读音超过一个，再追加“多音字”行列出全部候选。

示例：`重庆银行` 会展示默认拼音，同时列出 `重` 和 `行` 的多个候选读音。

## 英文音标原理

英文文本先用正则提取单词，再转为小写并去重。每个单词按两层策略处理：

1. 优先查询 `phoneticDictionary`。这个词典用于常见词和不规则词，因为自然拼读不能可靠覆盖 `one`、`said`、`does`、`people` 这类读法。
2. 如果词典未命中，调用 `buildPhonicsPronunciation()`（`src/reading/readingHelper.ts`）根据自然拼读规则生成近似音标，并在界面上标注“自然拼读近似”。

自然拼读规则用于扩大覆盖面，不替代专业词典。它对规则词效果较好，对外来词、缩写、专有名词和大量英语例外读法可能不准确。

## 语音播放原理

阅读结果框内提供小喇叭播放按钮。点击后，`playReadingSpeech()`（`src/components/SalaryCat.vue`）读取 `readingResult.source`，用 Web Speech API 创建 `SpeechSynthesisUtterance` 播放当前输入原文。

- 英文输入使用 `en-US`。
- 中文和混合输入使用 `zh-CN`。
- 每次播放前会先在 `src/components/SalaryCat.vue` 中调用 Web Speech API 的 `speechSynthesis.cancel()` 停止上一次播放。
- 关闭阅读面板或组件卸载时也会取消正在播放的语音。
- 如果环境不支持 Web Speech API，界面会显示“不支持语音播放”的提示。

## 前端交互原理

`SalaryCat.vue` 监听宠物区域右键事件并显示自定义菜单。点击“阅读”后由 `openReadingPanel()`（`src/components/SalaryCat.vue`）打开阅读面板，输入框自动聚焦。输入变化后，`readingResult` 计算属性即时调用 `getReadingResult()`（`src/reading/readingHelper.ts`）并渲染结果。

按 `Esc` 会关闭右键菜单和阅读面板。阅读面板打开时，点击宠物不会弹出随机语录，避免语录气泡和阅读面板互相打扰。
