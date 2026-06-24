import { pinyin, polyphonic } from 'pinyin-pro'

export type ReadingKind = 'empty' | 'chinese' | 'english' | 'mixed'

export interface ReadingResult {
  kind: ReadingKind
  source: string
  lines: string[]
}

const phoneticDictionary: Record<string, string> = {
  a: '/eɪ/',
  about: '/əˈbaʊt/',
  after: '/ˈæftər/',
  afternoon: '/ˌæftərˈnuːn/',
  again: '/əˈɡen/',
  all: '/ɔːl/',
  also: '/ˈɔːlsoʊ/',
  am: '/æm/',
  an: '/æn/',
  and: '/ænd/',
  app: '/æp/',
  are: '/ɑːr/',
  ask: '/æsk/',
  at: '/æt/',
  be: '/biː/',
  because: '/bɪˈkɔːz/',
  beautiful: '/ˈbjuːtɪfəl/',
  book: '/bʊk/',
  boy: '/bɔɪ/',
  can: '/kæn/',
  cat: '/kæt/',
  child: '/tʃaɪld/',
  code: '/koʊd/',
  coffee: '/ˈkɔːfi/',
  come: '/kʌm/',
  day: '/deɪ/',
  do: '/duː/',
  does: '/dʌz/',
  done: '/dʌn/',
  english: '/ˈɪŋɡlɪʃ/',
  every: '/ˈevri/',
  for: '/fɔːr/',
  friend: '/frend/',
  from: '/frəm/',
  girl: '/ɡɜːrl/',
  give: '/ɡɪv/',
  go: '/ɡoʊ/',
  good: '/ɡʊd/',
  great: '/ɡreɪt/',
  have: '/hæv/',
  he: '/hiː/',
  hello: '/həˈloʊ/',
  help: '/help/',
  her: '/hɜːr/',
  here: '/hɪr/',
  hi: '/haɪ/',
  his: '/hɪz/',
  how: '/haʊ/',
  i: '/aɪ/',
  is: '/ɪz/',
  it: '/ɪt/',
  learn: '/lɜːrn/',
  like: '/laɪk/',
  little: '/ˈlɪtəl/',
  love: '/lʌv/',
  make: '/meɪk/',
  me: '/miː/',
  money: '/ˈmʌni/',
  morning: '/ˈmɔːrnɪŋ/',
  my: '/maɪ/',
  night: '/naɪt/',
  no: '/noʊ/',
  of: '/əv/',
  on: '/ɑːn/',
  one: '/wʌn/',
  people: '/ˈpiːpəl/',
  pet: '/pet/',
  phone: '/foʊn/',
  please: '/pliːz/',
  put: '/pʊt/',
  read: '/riːd/',
  said: '/sed/',
  salary: '/ˈsæləri/',
  says: '/sez/',
  she: '/ʃiː/',
  some: '/sʌm/',
  thanks: '/θæŋks/',
  the: '/ðə/',
  their: '/ðer/',
  there: '/ðer/',
  they: '/ðeɪ/',
  this: '/ðɪs/',
  time: '/taɪm/',
  to: '/tuː/',
  today: '/təˈdeɪ/',
  translate: '/trænsˈleɪt/',
  two: '/tuː/',
  want: '/wɑːnt/',
  was: '/wʌz/',
  we: '/wiː/',
  were: '/wɜːr/',
  what: '/wʌt/',
  where: '/wer/',
  who: '/huː/',
  word: '/wɜːrd/',
  work: '/wɜːrk/',
  world: '/wɜːrld/',
  would: '/wʊd/',
  yes: '/jes/',
  you: '/juː/',
  your: '/jʊr/',
}

// 常见规则优先级高于单字母映射，用于给未收录英文生成可读的近似音标。
const longVowels: Record<string, string> = {
  a: 'eɪ',
  e: 'iː',
  i: 'aɪ',
  o: 'oʊ',
  u: 'juː',
}

const shortVowels: Record<string, string> = {
  a: 'æ',
  e: 'e',
  i: 'ɪ',
  o: 'ɑ',
  u: 'ʌ',
  y: 'i',
}

const phonicsPatterns: Array<[string, string]> = [
  ['eigh', 'eɪ'],
  ['augh', 'ɔː'],
  ['ough', 'ɔː'],
  ['tion', 'ʃən'],
  ['sion', 'ʒən'],
  ['ture', 'tʃər'],
  ['ph', 'f'],
  ['sh', 'ʃ'],
  ['ch', 'tʃ'],
  ['th', 'θ'],
  ['wh', 'w'],
  ['ck', 'k'],
  ['ng', 'ŋ'],
  ['qu', 'kw'],
  ['ee', 'iː'],
  ['ea', 'iː'],
  ['ai', 'eɪ'],
  ['ay', 'eɪ'],
  ['oa', 'oʊ'],
  ['oe', 'oʊ'],
  ['ow', 'aʊ'],
  ['ou', 'aʊ'],
  ['oi', 'ɔɪ'],
  ['oy', 'ɔɪ'],
  ['oo', 'uː'],
  ['ar', 'ɑːr'],
  ['er', 'ɜːr'],
  ['ir', 'ɜːr'],
  ['ur', 'ɜːr'],
  ['or', 'ɔːr'],
]

// 根据用户输入判断文本类型，并返回阅读面板需要展示的行。
export function getReadingResult(input: string): ReadingResult {
  const source = input.trim()

  if (!source) {
    return {
      kind: 'empty',
      source,
      lines: ['输入中文显示拼音，输入英文显示音标。'],
    }
  }

  const hasChinese = /[\u3400-\u9fff]/.test(source)
  const hasEnglish = /[a-z]/i.test(source)

  if (hasChinese && !hasEnglish) {
    return {
      kind: 'chinese',
      source,
      lines: getChineseLines(source),
    }
  }

  if (hasEnglish && !hasChinese) {
    return {
      kind: 'english',
      source,
      lines: getEnglishLines(source),
    }
  }

  return {
    kind: 'mixed',
    source,
    lines: [...getChineseLines(source, '中文'), ...getEnglishLines(source)],
  }
}

// 生成中文拼音行，并为多音字追加候选读音说明。
function getChineseLines(source: string, label = '拼音') {
  const defaultPinyin = pinyin(source, { toneType: 'symbol', type: 'array' }).join(' ')
  const characters = Array.from(source)
  // 默认拼音用于整句阅读，多音字候选单独列出，避免丢失可能读音。
  const candidates = polyphonic(source, { toneType: 'symbol', type: 'array' })
  const polyphonicLines = candidates
    .map((readings, index) => ({ character: characters[index], readings: [...new Set(readings)] }))
    .filter(({ character, readings }) => /[\u3400-\u9fff]/.test(character) && readings.length > 1)
    .map(({ character, readings }) => `${character}: ${readings.join(' / ')}`)

  return polyphonicLines.length > 0
    ? [`${label}: ${defaultPinyin}`, `多音字: ${polyphonicLines.join('; ')}`]
    : [`${label}: ${defaultPinyin}`]
}

// 生成英文单词音标行，词典未命中时回退到自然拼读近似。
function getEnglishLines(source: string) {
  const words = source.match(/[a-z]+(?:'[a-z]+)?/gi) ?? []
  // 同一个单词只展示一次，避免短句里重复词把结果框刷满。
  const uniqueWords = [...new Set(words.map((word) => word.toLowerCase()))]

  if (uniqueWords.length === 0) {
    return ['没有识别到英文单词。']
  }

  return uniqueWords.map((word) => {
    const phonetic = phoneticDictionary[word]

    if (phonetic) {
      return `${word} ${phonetic}`
    }

    return `${word} /${buildPhonicsPronunciation(word)}/ 自然拼读近似`
  })
}

// 按自然拼读规则为未收录英文单词生成近似音标。
function buildPhonicsPronunciation(word: string) {
  const normalized = word.toLowerCase().replace(/'s$/, '').replace(/'/g, '')
  const hasSilentFinalE = normalized.length > 2 && normalized.endsWith('e') && !normalized.endsWith('le')
  const readablePart = hasSilentFinalE ? normalized.slice(0, -1) : normalized
  const sounds: string[] = []

  for (let index = 0; index < readablePart.length; index += 1) {
    const rest = readablePart.slice(index)
    const longVowelSound = getLongVowelSound(readablePart, index, hasSilentFinalE)

    // 静音 e 先于普通组合处理，例如 make 中的 a。
    if (longVowelSound) {
      sounds.push(longVowelSound)
      continue
    }

    const pattern = phonicsPatterns.find(([letters]) => rest.startsWith(letters))

    if (pattern) {
      sounds.push(pattern[1])
      index += pattern[0].length - 1
      continue
    }

    sounds.push(letterToSound(readablePart[index], readablePart[index + 1], index === 0))
  }

  return sounds.join('')
}

// 判断静音 e 结构下当前位置是否应读成长元音。
function getLongVowelSound(word: string, index: number, hasSilentFinalE: boolean) {
  const letter = word[index]

  if (!hasSilentFinalE || !longVowels[letter]) {
    return ''
  }

  const isConsonantBeforeSilentE = index === word.length - 2 && !isVowel(letter)
  const isVowelBeforeLastConsonant = index === word.length - 3 && !isVowel(word[index + 1])

  if (isConsonantBeforeSilentE) {
    return letterToSound(letter, word[index + 1], index === 0)
  }

  return isVowelBeforeLastConsonant ? longVowels[letter] : ''
}

// 将单个字母映射为近似音素。
function letterToSound(letter: string, nextLetter = '', isFirstLetter = false) {
  if (letter === 'c') return /[eiy]/.test(nextLetter) ? 's' : 'k'
  if (letter === 'g') return /[eiy]/.test(nextLetter) ? 'dʒ' : 'ɡ'
  if (letter === 'j') return 'dʒ'
  if (letter === 'q') return 'k'
  if (letter === 'x') return 'ks'
  if (letter === 'y') return isFirstLetter ? 'j' : shortVowels.y
  if (shortVowels[letter]) return shortVowels[letter]

  return letter
}

// 判断字母是否按元音处理。
function isVowel(letter: string) {
  return /[aeiouy]/.test(letter)
}
