import type { CedictEntry } from 'cedict-json'

export type TranslationProvider = 'local' | 'baidu' | 'azure' | 'mymemory' | 'deepl'

export type TranslationKind = 'empty' | 'chinese' | 'english' | 'mixed' | 'error'

export interface TranslationSettings {
  provider: TranslationProvider
  baiduAppId: string
  baiduKey: string
  azureKey: string
  azureRegion: string
  deeplKey: string
}

export interface TranslationResult {
  kind: TranslationKind
  source: string
  lines: string[]
}

interface LocalResult {
  kind: Exclude<TranslationKind, 'empty' | 'error'>
  lines: string[]
}

const providerLabels: Record<TranslationProvider, string> = {
  local: '本地词典',
  baidu: '百度翻译',
  azure: 'Azure Translator',
  mymemory: 'MyMemory',
  deepl: 'DeepL',
}

let offlineDictionaryPromise: Promise<OfflineDictionary> | undefined

interface OfflineDictionary {
  chineseEntryMap: Map<string, CedictEntry[]>
  englishEntryMap: Map<string, CedictEntry[]>
}

const fallbackPhraseDictionary: Record<string, string> = {
  'good morning': '早上好',
  'good night': '晚安',
  'how are you': '你好吗',
  'i love you': '我爱你',
  'thank you': '谢谢你',
  'you are welcome': '不客气',
}

// 生成翻译面板展示结果；在线失败时自动附带本地兜底结果。
export async function getTranslationResult(
  input: string,
  settings: TranslationSettings,
): Promise<TranslationResult> {
  const source = input.trim()

  if (!source) {
    return {
      kind: 'empty',
      source,
      lines: ['输入英文翻译成中文，输入中文翻译成英文。'],
    }
  }

  const hasChinese = /[\u3400-\u9fff]/.test(source)
  const hasEnglish = /[a-z]/i.test(source)

  if (settings.provider === 'local') {
    const localResult = await getLocalTranslation(source)

    return {
      source,
      ...localResult,
    }
  }

  try {
    const onlineText = await translateOnline(source, settings)

    return {
      kind: getTranslationKind(source),
      source,
      lines: [`${providerLabels[settings.provider]}: ${onlineText}`],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '在线翻译失败'
    const localResult = await getLocalTranslation(source)

    return {
      kind: localResult.kind,
      source,
      lines: [`${providerLabels[settings.provider]}不可用: ${message}`, ...localResult.lines],
    }
  }
}

// 根据原文字符构成判断翻译结果类型。
function getTranslationKind(source: string): Exclude<TranslationKind, 'empty' | 'error'> {
  const hasChinese = /[\u3400-\u9fff]/.test(source)
  const hasEnglish = /[a-z]/i.test(source)

  if (hasChinese && !hasEnglish) return 'chinese'
  if (hasEnglish && !hasChinese) return 'english'

  return 'mixed'
}

// 使用离线词典执行本地双向翻译。
async function getLocalTranslation(source: string): Promise<LocalResult> {
  const hasChinese = /[\u3400-\u9fff]/.test(source)
  const hasEnglish = /[a-z]/i.test(source)
  const dictionary = await getOfflineDictionary()

  if (hasChinese && !hasEnglish) {
    return {
      kind: 'chinese',
      lines: getChineseExplanation(source, dictionary),
    }
  }

  if (hasEnglish && !hasChinese) {
    return {
      kind: 'english',
      lines: getEnglishTranslation(source, dictionary),
    }
  }

  return {
    kind: 'mixed',
    lines: ['混合文本建议使用在线翻译；本地模式暂只支持纯中文或纯英文词条。'],
  }
}

// 懒加载并缓存离线词典索引。
async function getOfflineDictionary() {
  if (!offlineDictionaryPromise) {
    // CC-CEDICT 体积较大，首次使用本地翻译时再加载，并复用同一个 Promise。
    offlineDictionaryPromise = import('cedict-json').then((module) => {
      const entries = module.default as CedictEntry[]

      return {
        chineseEntryMap: buildChineseEntryMap(entries),
        englishEntryMap: buildEnglishEntryMap(entries),
      }
    })
  }

  return offlineDictionaryPromise
}

// 用中文精确索引查询词条英文释义。
function getChineseExplanation(source: string, dictionary: OfflineDictionary) {
  const matches = dictionary.chineseEntryMap.get(source)

  if (matches?.length) {
    return matches.slice(0, 3).map(formatChineseEntry)
  }

  return ['离线词典暂未收录该中文词条，可切换在线翻译提供商。']
}

// 用英文释义反向索引查询候选中文词条。
function getEnglishTranslation(source: string, dictionary: OfflineDictionary) {
  const normalized = source.toLowerCase().replace(/[?!.,;:]+$/g, '').trim()
  const fallbackPhrase = fallbackPhraseDictionary[normalized]

  // CC-CEDICT 偏词条释义，少量口语短句用补充表直接返回。
  if (fallbackPhrase) {
    return [`翻译: ${fallbackPhrase}`]
  }

  const phraseMatches = dictionary.englishEntryMap.get(normalized)

  if (phraseMatches?.length) {
    return formatEnglishMatches(normalized, phraseMatches)
  }

  const words = normalized.match(/[a-z]+(?:'[a-z]+)?/gi) ?? []

  if (words.length === 1) {
    const matches = dictionary.englishEntryMap.get(words[0])
    return matches?.length
      ? formatEnglishMatches(words[0], matches)
      : ['离线词典暂未匹配到该英文释义，可切换在线翻译提供商。']
  }

  const translatedWords = words.map((word) => {
    const matches = dictionary.englishEntryMap.get(word)
    return matches?.length ? `${word}: ${matches.slice(0, 3).map((entry) => entry.simplified).join(' / ')}` : `${word}: 未匹配`
  })

  return ['本地短句逐词释义:', ...translatedWords]
}

// 建立简体和繁体中文到词条的精确索引。
function buildChineseEntryMap(entries: CedictEntry[]) {
  const map = new Map<string, CedictEntry[]>()

  entries.forEach((entry) => {
    addEntry(map, entry.simplified, entry)
    addEntry(map, entry.traditional, entry)
  })

  return map
}

// 建立英文释义片段到中文词条的反向索引。
function buildEnglishEntryMap(entries: CedictEntry[]) {
  const map = new Map<string, CedictEntry[]>()

  // 英译中通过反向索引实现：从中文词条的英文释义里提取可匹配短语。
  entries.forEach((entry) => {
    entry.english.forEach((definition) => {
      extractEnglishTerms(definition).forEach((term) => addEntry(map, term, entry))
    })
  })

  return map
}

// 规范化索引 key，并把一个词条加入索引。
function addEntry(map: Map<string, CedictEntry[]>, key: string, entry: CedictEntry) {
  const normalizedKey = key.trim().toLowerCase()

  if (!normalizedKey || normalizedKey.length > 48) return

  const keys = new Set([normalizedKey])

  // 给简单复数补一个单数 key，提高英文反查的命中率。
  if (/^[a-z][a-z -]+s$/.test(normalizedKey)) {
    keys.add(normalizedKey.replace(/s$/, ''))
  }

  keys.forEach((candidateKey) => addSingleEntry(map, candidateKey, entry))
}

// 将词条加入单个 key 的候选列表，并去重限量。
function addSingleEntry(map: Map<string, CedictEntry[]>, key: string, entry: CedictEntry) {
  const entries = map.get(key) ?? []

  if (entries.length >= 12 || entries.some((item) => item.simplified === entry.simplified && item.pinyin === entry.pinyin)) return

  entries.push(entry)
  map.set(key, entries)
}

// 从 CC-CEDICT 英文释义中提取适合反查的短语片段。
function extractEnglishTerms(definition: string) {
  const clean = definition
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/"([^"]+)"/g, '$1')
    .replace(/\b(to|a|an|the|sb|sth|one's|oneself)\b/gi, ' ')
  const parts = clean
    .split(/[;,/]| or | and | etc\.?/i)
    .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9' -]/g, '').replace(/\s+/g, ' '))
    .filter((part) => part && part.length > 1)

  return [...new Set(parts)]
}

// 格式化中文查询命中的词条。
function formatChineseEntry(entry: CedictEntry) {
  return `${entry.simplified} [${entry.pinyin}]: ${entry.english.slice(0, 3).join('；')}`
}

// 格式化英文反查命中的候选中文词条。
function formatEnglishMatches(word: string, matches: CedictEntry[]) {
  return [`${word}: ${matches.slice(0, 6).map((entry) => `${entry.simplified} [${entry.pinyin}]`).join(' / ')}`]
}

// 按当前 provider 分发到对应在线翻译实现。
async function translateOnline(source: string, settings: TranslationSettings) {
  // 在线 provider 都按输入语言自动选择目标语言：中文转英文，英文转中文。
  if (settings.provider === 'baidu') return translateWithBaidu(source, settings)
  if (settings.provider === 'azure') return translateWithAzure(source, settings)
  if (settings.provider === 'mymemory') return translateWithMyMemory(source)
  if (settings.provider === 'deepl') return translateWithDeepL(source, settings)

  throw new Error('未选择在线翻译提供商')
}

// 调用百度翻译 API，并生成其要求的签名参数。
async function translateWithBaidu(source: string, settings: TranslationSettings) {
  if (!settings.baiduAppId || !settings.baiduKey) {
    throw new Error('请填写百度 App ID 和密钥')
  }

  const salt = String(Date.now())
  const from = /[\u3400-\u9fff]/.test(source) ? 'auto' : 'en'
  const to = /[\u3400-\u9fff]/.test(source) ? 'en' : 'zh'
  const sign = md5(`${settings.baiduAppId}${source}${salt}${settings.baiduKey}`)
  const body = new URLSearchParams({
    q: source,
    from,
    to,
    appid: settings.baiduAppId,
    salt,
    sign,
  })
  const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json()

  if (!response.ok || data.error_code) {
    throw new Error(data.error_msg || `请求失败 ${response.status}`)
  }

  return data.trans_result?.map((item: { dst: string }) => item.dst).join('；') || '未返回翻译结果'
}

// 调用 Azure Translator API。
async function translateWithAzure(source: string, settings: TranslationSettings) {
  if (!settings.azureKey) {
    throw new Error('请填写 Azure 密钥')
  }

  const targetLanguage = /[\u3400-\u9fff]/.test(source) ? 'en' : 'zh-Hans'
  const response = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLanguage}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': settings.azureKey,
      ...(settings.azureRegion ? { 'Ocp-Apim-Subscription-Region': settings.azureRegion } : {}),
    },
    body: JSON.stringify([{ text: source }]),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message || `请求失败 ${response.status}`)
  }

  return data[0]?.translations?.[0]?.text || '未返回翻译结果'
}

// 调用 MyMemory 免费翻译接口。
async function translateWithMyMemory(source: string) {
  const langpair = /[\u3400-\u9fff]/.test(source) ? 'zh-CN|en' : 'en|zh-CN'
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(source)}&langpair=${encodeURIComponent(langpair)}`
  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok || data.responseStatus >= 400) {
    throw new Error(data.responseDetails || `请求失败 ${response.status}`)
  }

  return data.responseData?.translatedText || '未返回翻译结果'
}

// 调用 DeepL API Free 翻译接口。
async function translateWithDeepL(source: string, settings: TranslationSettings) {
  if (!settings.deeplKey) {
    throw new Error('请填写 DeepL API Key')
  }

  const targetLanguage = /[\u3400-\u9fff]/.test(source) ? 'EN-US' : 'ZH'
  const body = new URLSearchParams({
    text: source,
    target_lang: targetLanguage,
  })
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${settings.deeplKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || `请求失败 ${response.status}`)
  }

  return data.translations?.[0]?.text || '未返回翻译结果'
}

// 计算百度翻译签名所需的 MD5 值。
function md5(input: string) {
  // 百度翻译签名要求 MD5；这里内置实现避免再引入一个小依赖。
  const rotateLeft = (value: number, shift: number) => (value << shift) | (value >>> (32 - shift))
  const add = (left: number, right: number) => (left + right) & 0xffffffff
  const cmn = (q: number, a: number, b: number, x: number, s: number, t: number) => add(rotateLeft(add(add(a, q), add(x, t)), s), b)
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn((b & c) | (~b & d), a, b, x, s, t)
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn((b & d) | (c & ~d), a, b, x, s, t)
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn(b ^ c ^ d, a, b, x, s, t)
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn(c ^ (b | ~d), a, b, x, s, t)
  const words = stringToWords(input)
  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476

  for (let index = 0; index < words.length; index += 16) {
    const oldA = a
    const oldB = b
    const oldC = c
    const oldD = d

    a = ff(a, b, c, d, words[index], 7, 0xd76aa478)
    d = ff(d, a, b, c, words[index + 1], 12, 0xe8c7b756)
    c = ff(c, d, a, b, words[index + 2], 17, 0x242070db)
    b = ff(b, c, d, a, words[index + 3], 22, 0xc1bdceee)
    a = ff(a, b, c, d, words[index + 4], 7, 0xf57c0faf)
    d = ff(d, a, b, c, words[index + 5], 12, 0x4787c62a)
    c = ff(c, d, a, b, words[index + 6], 17, 0xa8304613)
    b = ff(b, c, d, a, words[index + 7], 22, 0xfd469501)
    a = ff(a, b, c, d, words[index + 8], 7, 0x698098d8)
    d = ff(d, a, b, c, words[index + 9], 12, 0x8b44f7af)
    c = ff(c, d, a, b, words[index + 10], 17, 0xffff5bb1)
    b = ff(b, c, d, a, words[index + 11], 22, 0x895cd7be)
    a = ff(a, b, c, d, words[index + 12], 7, 0x6b901122)
    d = ff(d, a, b, c, words[index + 13], 12, 0xfd987193)
    c = ff(c, d, a, b, words[index + 14], 17, 0xa679438e)
    b = ff(b, c, d, a, words[index + 15], 22, 0x49b40821)
    a = gg(a, b, c, d, words[index + 1], 5, 0xf61e2562)
    d = gg(d, a, b, c, words[index + 6], 9, 0xc040b340)
    c = gg(c, d, a, b, words[index + 11], 14, 0x265e5a51)
    b = gg(b, c, d, a, words[index], 20, 0xe9b6c7aa)
    a = gg(a, b, c, d, words[index + 5], 5, 0xd62f105d)
    d = gg(d, a, b, c, words[index + 10], 9, 0x02441453)
    c = gg(c, d, a, b, words[index + 15], 14, 0xd8a1e681)
    b = gg(b, c, d, a, words[index + 4], 20, 0xe7d3fbc8)
    a = gg(a, b, c, d, words[index + 9], 5, 0x21e1cde6)
    d = gg(d, a, b, c, words[index + 14], 9, 0xc33707d6)
    c = gg(c, d, a, b, words[index + 3], 14, 0xf4d50d87)
    b = gg(b, c, d, a, words[index + 8], 20, 0x455a14ed)
    a = gg(a, b, c, d, words[index + 13], 5, 0xa9e3e905)
    d = gg(d, a, b, c, words[index + 2], 9, 0xfcefa3f8)
    c = gg(c, d, a, b, words[index + 7], 14, 0x676f02d9)
    b = gg(b, c, d, a, words[index + 12], 20, 0x8d2a4c8a)
    a = hh(a, b, c, d, words[index + 5], 4, 0xfffa3942)
    d = hh(d, a, b, c, words[index + 8], 11, 0x8771f681)
    c = hh(c, d, a, b, words[index + 11], 16, 0x6d9d6122)
    b = hh(b, c, d, a, words[index + 14], 23, 0xfde5380c)
    a = hh(a, b, c, d, words[index + 1], 4, 0xa4beea44)
    d = hh(d, a, b, c, words[index + 4], 11, 0x4bdecfa9)
    c = hh(c, d, a, b, words[index + 7], 16, 0xf6bb4b60)
    b = hh(b, c, d, a, words[index + 10], 23, 0xbebfbc70)
    a = hh(a, b, c, d, words[index + 13], 4, 0x289b7ec6)
    d = hh(d, a, b, c, words[index], 11, 0xeaa127fa)
    c = hh(c, d, a, b, words[index + 3], 16, 0xd4ef3085)
    b = hh(b, c, d, a, words[index + 6], 23, 0x04881d05)
    a = hh(a, b, c, d, words[index + 9], 4, 0xd9d4d039)
    d = hh(d, a, b, c, words[index + 12], 11, 0xe6db99e5)
    c = hh(c, d, a, b, words[index + 15], 16, 0x1fa27cf8)
    b = hh(b, c, d, a, words[index + 2], 23, 0xc4ac5665)
    a = ii(a, b, c, d, words[index], 6, 0xf4292244)
    d = ii(d, a, b, c, words[index + 7], 10, 0x432aff97)
    c = ii(c, d, a, b, words[index + 14], 15, 0xab9423a7)
    b = ii(b, c, d, a, words[index + 5], 21, 0xfc93a039)
    a = ii(a, b, c, d, words[index + 12], 6, 0x655b59c3)
    d = ii(d, a, b, c, words[index + 3], 10, 0x8f0ccc92)
    c = ii(c, d, a, b, words[index + 10], 15, 0xffeff47d)
    b = ii(b, c, d, a, words[index + 1], 21, 0x85845dd1)
    a = ii(a, b, c, d, words[index + 8], 6, 0x6fa87e4f)
    d = ii(d, a, b, c, words[index + 15], 10, 0xfe2ce6e0)
    c = ii(c, d, a, b, words[index + 6], 15, 0xa3014314)
    b = ii(b, c, d, a, words[index + 13], 21, 0x4e0811a1)
    a = ii(a, b, c, d, words[index + 4], 6, 0xf7537e82)
    d = ii(d, a, b, c, words[index + 11], 10, 0xbd3af235)
    c = ii(c, d, a, b, words[index + 2], 15, 0x2ad7d2bb)
    b = ii(b, c, d, a, words[index + 9], 21, 0xeb86d391)
    a = add(a, oldA)
    b = add(b, oldB)
    c = add(c, oldC)
    d = add(d, oldD)
  }

  return [a, b, c, d].map(wordToHex).join('')
}

// 将 UTF-8 字节填充成 MD5 运算使用的 32 位字数组。
function stringToWords(input: string) {
  const bytes = new TextEncoder().encode(input)
  const words: number[] = []

  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] |= bytes[index] << ((index % 4) * 8)
  }

  words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8)
  words[(((bytes.length + 8) >> 6) + 1) * 16 - 2] = bytes.length * 8

  for (let index = 0; index < words.length; index += 1) {
    words[index] ||= 0
  }

  return words
}

// 将 MD5 内部 32 位字转换为小端十六进制字符串。
function wordToHex(value: number) {
  let output = ''

  for (let index = 0; index < 4; index += 1) {
    output += ((value >>> (index * 8)) & 0xff).toString(16).padStart(2, '0')
  }

  return output
}
