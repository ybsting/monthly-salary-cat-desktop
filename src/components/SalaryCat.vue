<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition, type Window as TauriWindow } from '@tauri-apps/api/window'
import { pickGif, pickNextAnimation, type CatAnimationName } from '../animation/catAnimation'
import { workQuotes } from '../data/quotes'
import { getTodayNews, type NewsProvider, type NewsResult } from '../news/newsHelper'
import { getReadingResult } from '../reading/readingHelper'
import { getTranslationResult, type TranslationProvider, type TranslationResult } from '../translation/translationHelper'

type MailAttachmentPayload = {
  fileName: string
  mimeType: string
  bytes: number[]
}

type MailConfigPayload = {
  authCode: string
  smtpHost: string
  imapHost: string
}

type MailSendPayload = {
  to: string
  subject: string
  body: string
  attachments: MailAttachmentPayload[]
  config: MailConfigPayload
}

type MailInboxAttachment = {
  id: string
  fileName: string
  mimeType: string
  size: number
  contentBase64: string
}

type MailStatusKind = 'idle' | 'loading' | 'success' | 'error'
type MailMode = 'send' | 'inbox'

type SaveFilePickerOptions = {
  suggestedName?: string
  types?: Array<{
    description: string
    accept: Record<string, string[]>
  }>
}

type SaveFilePickerHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>
  }
}

type MailInboxItem = {
  id: string
  from: string
  subject: string
  date: string
  preview: string
  unread?: boolean
  body?: string
  attachments?: MailInboxAttachment[]
}

const maxMailAttachmentBytes = 5 * 1024 * 1024
const mailSendTimeoutMs = 30_000
const mailInboxPollIntervalMs = 60_000
const animationName = ref<CatAnimationName>('idle')
const currentGifUrl = ref('')
const bubbleText = ref('')
const isBubbleVisible = ref(false)
const isBubblePersistent = ref(false)
const isPressed = ref(false)
const isContextMenuVisible = ref(false)
const isReadingPanelVisible = ref(false)
const isTranslationPanelVisible = ref(false)
const isNewsPanelVisible = ref(false)
const isMailPanelVisible = ref(false)
const readingInput = ref('')
const speechStatus = ref('')
const translationInput = ref('')
const translationStatus = ref('')
const mailTo = ref(readStoredValue('monthlySalaryCat.mail.to', ''))
const mailAuthCode = ref(readStoredValue('monthlySalaryCat.mail.authCode', ''))
const mailSmtpHost = ref(readStoredValue('monthlySalaryCat.mail.smtpHost', 'smtp.163.com'))
const mailImapHost = ref(readStoredValue('monthlySalaryCat.mail.imapHost', 'imap.163.com'))
const mailSubject = ref('')
const mailBody = ref('')
const mailStatus = ref('')
const mailStatusKind = ref<MailStatusKind>('idle')
const mailAttachments = ref<MailAttachmentPayload[]>([])
const mailScheduledAt = ref('')
const scheduledMailSummary = ref('')
const mailMode = ref<MailMode>('send')
const mailInboxStatus = ref('尚未刷新收件箱')
const mailInboxStatusKind = ref<MailStatusKind>('idle')
const mailInboxItems = ref<MailInboxItem[]>([])
const selectedMailInboxItem = ref<MailInboxItem | null>(null)
const petCanvasWidth = 320
const petCanvasHeight = 320
const toolCanvasWidth = 760
const toolCanvasHeight = 560
const toolPanelMarginX = 10
const toolPanelMarginY = 8
const minToolPanelWidth = 220
const minToolPanelHeight = 160
const defaultToolPanelSize = { width: 360, height: 320 }
const toolPanelSize = ref({ ...defaultToolPanelSize })
const viewportSize = ref({ width: toolCanvasWidth, height: toolCanvasHeight })
const translationProvider = ref<TranslationProvider>(readStoredValue('monthlySalaryCat.translation.provider', 'local') as TranslationProvider)
const baiduAppId = ref(readStoredValue('monthlySalaryCat.translation.baiduAppId', ''))
const baiduKey = ref(readStoredValue('monthlySalaryCat.translation.baiduKey', ''))
const azureKey = ref(readStoredValue('monthlySalaryCat.translation.azureKey', ''))
const azureRegion = ref(readStoredValue('monthlySalaryCat.translation.azureRegion', ''))
const deeplKey = ref(readStoredValue('monthlySalaryCat.translation.deeplKey', ''))
const newsProvider = ref<NewsProvider>(readStoredValue('monthlySalaryCat.news.provider', 'juhe') as NewsProvider)
const juheNewsKey = ref(readStoredValue('monthlySalaryCat.news.juheKey', ''))
const juheNewsCategory = ref(readStoredValue('monthlySalaryCat.news.juheCategory', 'top'))
const translationResult = ref<TranslationResult>({
  kind: 'empty',
  source: '',
  lines: ['输入英文翻译成中文，输入中文翻译成英文。'],
})

// 工具面板都复用同一个舞台空间；结果区内部滚动，避免扩大透明窗口。
const newsResult = ref<NewsResult>({
  status: 'empty',
  message: '填写新闻 Key 后点击刷新，查看今日新闻。',
  items: [],
})
const menuPosition = ref({ x: 12, y: 12 })
const menuElement = useTemplateRef<HTMLElement>('menuElement')
const readingInputElement = useTemplateRef<HTMLInputElement>('readingInputElement')
const translationInputElement = useTemplateRef<HTMLInputElement>('translationInputElement')
const mailToInputElement = useTemplateRef<HTMLInputElement>('mailToInputElement')
const mailFileInputElement = useTemplateRef<HTMLInputElement>('mailFileInputElement')

let animationTimer: number | undefined
let bubbleTimer: number | undefined
let clockBubbleTimer: number | undefined
let scheduledMailTimer: number | undefined
let mailInboxFallbackPollTimer: number | undefined
let mailInboxKnownIds = new Set<string>()
let panelResizeStart: { x: number; y: number; width: number; height: number } | null = null

const readingResult = computed(() => getReadingResult(readingInput.value))
const mailSendButtonText = computed(() => (mailScheduledAt.value ? '定时发送' : '发送'))
const minScheduledMailDateTime = computed(() => formatDateTimeLocalValue(new Date(Date.now() + 60_000)))
const toolPanelStyle = computed(() => ({
  width: `${clamp(toolPanelSize.value.width, minToolPanelWidth, maxToolPanelWidth.value)}px`,
  height: `${clamp(toolPanelSize.value.height, minToolPanelHeight, maxToolPanelHeight.value)}px`,
  maxWidth: `calc(100% - ${toolPanelMarginX * 2}px)`,
  maxHeight: `calc(100% - ${toolPanelMarginY * 2}px)`,
}))

const maxToolPanelWidth = computed(() => Math.max(minToolPanelWidth, viewportSize.value.width - toolPanelMarginX * 2))
const maxToolPanelHeight = computed(() => Math.max(minToolPanelHeight, viewportSize.value.height - toolPanelMarginY * 2))

const translationSettings = computed(() => ({
  provider: translationProvider.value,
  baiduAppId: baiduAppId.value.trim(),
  baiduKey: baiduKey.value.trim(),
  azureKey: azureKey.value.trim(),
  azureRegion: azureRegion.value.trim(),
  deeplKey: deeplKey.value.trim(),
}))

const newsSettings = computed(() => ({
  provider: newsProvider.value,
  juheKey: juheNewsKey.value.trim(),
  juheCategory: juheNewsCategory.value,
}))

const mailConfig = computed<MailConfigPayload>(() => ({
  authCode: mailAuthCode.value.trim(),
  smtpHost: mailSmtpHost.value.trim() || 'smtp.163.com',
  imapHost: mailImapHost.value.trim() || 'imap.163.com',
}))

// 从 localStorage 读取工具配置，读取失败时返回默认值。
function readStoredValue(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

// 将工具配置写入 localStorage，受限环境下静默跳过。
function saveStoredValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Local storage may be unavailable in restricted previews.
  }
}

function formatDateTimeLocalValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// 用户拖动工具框右下角时调整所有功能框的展示尺寸。
function startToolPanelResize(event: MouseEvent) {
  panelResizeStart = {
    x: event.clientX,
    y: event.clientY,
    width: toolPanelSize.value.width,
    height: toolPanelSize.value.height,
  }
  window.addEventListener('mousemove', resizeToolPanel)
  window.addEventListener('mouseup', stopToolPanelResize)
}

function resizeToolPanel(event: MouseEvent) {
  if (!panelResizeStart) return

  updateViewportSize()
  const nextWidth = clamp(panelResizeStart.width + event.clientX - panelResizeStart.x, minToolPanelWidth, maxToolPanelWidth.value)
  const nextHeight = clamp(panelResizeStart.height + event.clientY - panelResizeStart.y, minToolPanelHeight, maxToolPanelHeight.value)
  toolPanelSize.value = { width: nextWidth, height: nextHeight }
}

function stopToolPanelResize() {
  panelResizeStart = null
  window.removeEventListener('mousemove', resizeToolPanel)
  window.removeEventListener('mouseup', stopToolPanelResize)
}

function resetToolPanelSize() {
  toolPanelSize.value = { ...defaultToolPanelSize }
}

function updateViewportSize() {
  viewportSize.value = {
    width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, petCanvasWidth),
    height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0, petCanvasHeight),
  }
}

async function setPetWindowSize(width: number, height: number) {
  if (!isTauriRuntime()) return

  const currentWindow = getCurrentWindow()
  try {
    await currentWindow.setSize(new LogicalSize(width, height))
    await keepWindowInsideCurrentMonitor(currentWindow, width, height)
    window.setTimeout(() => {
      void keepWindowInsideCurrentMonitor(currentWindow, width, height)
    }, 120)
  } catch (_) {
    // Older debug executables may not include every window permission until rebuilt.
  }

  viewportSize.value = { width, height }
  window.setTimeout(updateViewportSize, 80)
}

async function keepWindowInsideCurrentMonitor(currentWindow: TauriWindow, logicalWidth: number, logicalHeight: number) {
  const monitor = await currentMonitor()
  const position = await currentWindow.outerPosition()

  if (!monitor || !position) return

  const scaleFactor = Number(monitor.scaleFactor || 1)
  const monitorArea = monitor.workArea || {
    position: monitor.position,
    size: monitor.size,
  }
  const margin = Math.round(8 * scaleFactor)
  const windowWidth = Math.round(logicalWidth * scaleFactor)
  const windowHeight = Math.round(logicalHeight * scaleFactor)
  const minX = monitorArea.position.x + margin
  const minY = monitorArea.position.y + margin
  const maxX = monitorArea.position.x + monitorArea.size.width - windowWidth - margin
  const maxY = monitorArea.position.y + monitorArea.size.height - windowHeight - margin
  const nextX = clamp(position.x, minX, Math.max(minX, maxX))
  const nextY = clamp(position.y, minY, Math.max(minY, maxY))

  if (nextX === position.x && nextY === position.y) return

  await currentWindow.setPosition(new PhysicalPosition(nextX, nextY))
}

async function ensureToolCanvasSize() {
  await setPetWindowSize(toolCanvasWidth, toolCanvasHeight)
}

async function restorePetCanvasSize() {
  await setPetWindowSize(petCanvasWidth, petCanvasHeight)
}

function restorePetCanvasSizeIfNoToolPanels() {
  if (
    isReadingPanelVisible.value ||
    isTranslationPanelVisible.value ||
    isNewsPanelVisible.value ||
    isMailPanelVisible.value
  ) return

  void restorePetCanvasSize()
}

// 选择并展示下一段宠物 GIF，随后安排下一次切换。
function scheduleNextGif() {
  window.clearTimeout(animationTimer)

  // GIF 内部自带帧动画，这里只按分组切换不同 GIF 文件。
  const gif = pickGif(animationName.value, currentGifUrl.value)
  currentGifUrl.value = gif.url

  animationTimer = window.setTimeout(() => {
    animationName.value = pickNextAnimation()
    scheduleNextGif()
  }, gif.duration)
}

// 左键互动时随机展示一句打工语录。
function showRandomQuote() {
  // 工具面板打开时不弹气泡，避免遮住输入和结果。
  if (
    isReadingPanelVisible.value ||
    isTranslationPanelVisible.value ||
    isNewsPanelVisible.value ||
    isMailPanelVisible.value
  ) return

  const quote = workQuotes[Math.floor(Math.random() * workQuotes.length)]
  showBubble(quote)
}

// 展示气泡文本，并在短暂延迟后自动隐藏。
function showBubble(text: string, options: { persistent?: boolean } = {}) {
  if (isBubblePersistent.value && !options.persistent) return

  bubbleText.value = text
  isBubbleVisible.value = true
  isBubblePersistent.value = Boolean(options.persistent)

  window.clearTimeout(bubbleTimer)
  if (!options.persistent) {
    bubbleTimer = window.setTimeout(() => {
      hideBubble()
    }, 2200)
  }
}

function hideBubble() {
  window.clearTimeout(bubbleTimer)
  isBubbleVisible.value = false
  isBubblePersistent.value = false
}

// 计算下一次整点/半点提示时间，并设置定时器。
function scheduleNextClockBubble() {
  window.clearTimeout(clockBubbleTimer)

  clockBubbleTimer = window.setTimeout(() => {
    showClockBubble()
    scheduleNextClockBubble()
  }, getNextClockBubbleDelay())
}

// 在没有工具面板遮挡时展示当前时间气泡。
function showClockBubble() {
  if (
    isReadingPanelVisible.value ||
    isTranslationPanelVisible.value ||
    isNewsPanelVisible.value ||
    isMailPanelVisible.value
  ) return

  showBubble(`现在是 ${formatCurrentTime(new Date())}`)
}

// 返回距离下一次整点或半点的毫秒数。
function getNextClockBubbleDelay() {
  const now = new Date()
  const next = new Date(now)
  const minutes = now.getMinutes()

  next.setSeconds(0, 0)

  // 时间气泡只在整点或半点触发，每次触发后重新计算下一次延迟。
  if (minutes < 30) {
    next.setMinutes(30)
  } else {
    next.setHours(next.getHours() + 1, 0)
  }

  return Math.max(next.getTime() - now.getTime(), 1000)
}

// 将时间格式化为桌宠气泡里使用的 HH:mm。
function formatCurrentTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// 判断当前是否运行在 Tauri WebView 中。
function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

type WindowDragOptions = {
  pressPet?: boolean
  showQuote?: boolean
}

// 触发系统级窗口拖拽。宠物本体和工具面板共用这条路径，但反馈表现不同。
async function startWindowDrag(event: MouseEvent, options: WindowDragOptions = {}) {
  if (event.button !== 0 || isContextMenuVisible.value) return

  if (options.pressPet) {
    isPressed.value = true
  }

  const hadPersistentBubble = isBubblePersistent.value
  hideBubble()
  if (options.showQuote && !hadPersistentBubble) {
    showRandomQuote()
  }

  // 浏览器预览没有原生窗口，只有 Tauri 环境才启动系统级拖拽。
  if (!isTauriRuntime()) return

  try {
    await getCurrentWindow().startDragging()
  } catch (error) {
    console.warn('启动窗口拖拽失败', error)
  }
}

// 左键按下宠物本体时触发桌宠拖拽，并展示一次互动语录。
async function startDrag(event: MouseEvent) {
  await startWindowDrag(event, { pressPet: true, showQuote: true })
}

function isToolPanelInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false

  return Boolean(
    target.closest(
      [
        'a',
        'button',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '.tool-panel__resize',
        '.reading-panel__result',
        '.translation-panel__settings',
        '.news-panel__list',
        '.mail-panel__attachments',
        '.mail-panel__scheduled',
        '.mail-panel__inbox-detail',
        '.mail-panel__inbox-list',
      ].join(','),
    ),
  )
}

// 功能框空白处和标题区域也允许拖动窗口；表单、按钮、列表和正文区域保留原交互。
async function handleToolPanelMouseDown(event: MouseEvent) {
  event.stopPropagation()

  if (isToolPanelInteractiveTarget(event.target)) return

  event.preventDefault()
  await startWindowDrag(event)
}

// 清除鼠标按压时的视觉状态。
function stopPress() {
  isPressed.value = false
}

// 根据右键位置打开自定义菜单，并在渲染后修正边界。
async function openContextMenu(event: MouseEvent) {
  const stageRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - stageRect.left
  const y = event.clientY - stageRect.top

  isContextMenuVisible.value = true
  menuPosition.value = {
    x: Math.max(x, 0),
    y: Math.max(y, 0),
  }

  await nextTick()
  // 菜单真实尺寸只有渲染后才知道，下一帧再收回舞台边界内。
  keepContextMenuInsideStage(stageRect.width, stageRect.height)
}

// 用菜单真实尺寸把菜单位置限制在宠物窗口内部。
function keepContextMenuInsideStage(stageWidth: number, stageHeight: number) {
  const menuRect = menuElement.value?.getBoundingClientRect()
  const margin = 4

  if (!menuRect) return

  menuPosition.value = {
    x: clamp(menuPosition.value.x, margin, stageWidth - menuRect.width - margin),
    y: clamp(menuPosition.value.y, margin, stageHeight - menuRect.height - margin),
  }
}

// 将数值限制在指定区间内。
function clamp(value: number, min: number, max: number) {
  if (max < min) return min

  return Math.min(Math.max(value, min), max)
}

// 打开阅读面板，并关闭其他互斥工具面板。
async function openReadingPanel() {
  resetToolPanelSize()
  await ensureToolCanvasSize()
  isContextMenuVisible.value = false
  isReadingPanelVisible.value = true
  isTranslationPanelVisible.value = false
  isNewsPanelVisible.value = false
  isMailPanelVisible.value = false
  hideBubble()

  await nextTick()
  readingInputElement.value?.focus()
}

// 关闭阅读面板并清理输入和播放状态。
function closeReadingPanel() {
  stopReadingSpeech()
  isReadingPanelVisible.value = false
  readingInput.value = ''
  speechStatus.value = ''
  restorePetCanvasSizeIfNoToolPanels()
}

// 打开翻译面板，并关闭其他互斥工具面板。
async function openTranslationPanel() {
  resetToolPanelSize()
  await ensureToolCanvasSize()
  stopReadingSpeech()
  isContextMenuVisible.value = false
  isReadingPanelVisible.value = false
  isTranslationPanelVisible.value = true
  isNewsPanelVisible.value = false
  isMailPanelVisible.value = false
  hideBubble()
  translationStatus.value = ''

  await nextTick()
  translationInputElement.value?.focus()
}

// 关闭翻译面板并清理输入和状态。
function closeTranslationPanel() {
  isTranslationPanelVisible.value = false
  translationInput.value = ''
  translationStatus.value = ''
  restorePetCanvasSizeIfNoToolPanels()
}

// 打开新闻面板，首次进入时自动拉取新闻。
async function openNewsPanel() {
  resetToolPanelSize()
  await ensureToolCanvasSize()
  stopReadingSpeech()
  isContextMenuVisible.value = false
  isReadingPanelVisible.value = false
  isTranslationPanelVisible.value = false
  isNewsPanelVisible.value = true
  isMailPanelVisible.value = false
  hideBubble()

  if (!newsResult.value.items.length && newsResult.value.status !== 'error') {
    await refreshNewsResult()
  }
}

// 关闭新闻面板，保留已拉取的新闻列表缓存。
function closeNewsPanel() {
  isNewsPanelVisible.value = false
  restorePetCanvasSizeIfNoToolPanels()
}

// 打开邮件面板，并关闭其他互斥工具面板。
async function openMailPanel() {
  resetToolPanelSize()
  await ensureToolCanvasSize()
  stopReadingSpeech()
  isContextMenuVisible.value = false
  isReadingPanelVisible.value = false
  isTranslationPanelVisible.value = false
  isNewsPanelVisible.value = false
  isMailPanelVisible.value = true
  hideBubble()

  await nextTick()
  if (mailMode.value === 'send') {
    mailToInputElement.value?.focus()
  }
}

// 关闭邮件面板并清理单次编辑内容。
function closeMailPanel() {
  isMailPanelVisible.value = false
  mailSubject.value = ''
  mailBody.value = ''
  mailScheduledAt.value = ''
  mailStatus.value = ''
  mailStatusKind.value = 'idle'
  mailAttachments.value = []

  if (mailFileInputElement.value) {
    mailFileInputElement.value.value = ''
  }

  restorePetCanvasSizeIfNoToolPanels()
}

// 切换邮件面板模式，首次进入收件箱时自动刷新。
async function switchMailMode(mode: MailMode) {
  mailMode.value = mode

  await nextTick()

  if (mode === 'send') {
    mailToInputElement.value?.focus()
    return
  }

  selectedMailInboxItem.value = null

  if (!mailInboxItems.value.length && mailInboxStatusKind.value !== 'error') {
    await fetchMailInbox()
  }
}

// 读取用户选择的附件，转换为可传给 Rust 命令的字节数组。
async function handleMailAttachmentChange(event: Event) {
  const inputElement = event.target as HTMLInputElement
  const files = Array.from(inputElement.files || [])
  const currentBytes = mailAttachments.value.reduce((sum, attachment) => sum + attachment.bytes.length, 0)
  const newBytes = files.reduce((sum, file) => sum + file.size, 0)
  const totalBytes = currentBytes + newBytes

  if (totalBytes > maxMailAttachmentBytes) {
    mailStatus.value = '附件总大小不能超过 5MB'
    mailStatusKind.value = 'error'
    inputElement.value = ''
    return
  }

  try {
    mailStatus.value = files.length ? '附件读取中' : ''
    mailStatusKind.value = files.length ? 'loading' : 'idle'
    const newAttachments = await Promise.all(files.map(readMailAttachment))
    mailAttachments.value = [...mailAttachments.value, ...newAttachments]
    mailStatus.value = mailAttachments.value.length ? `已选择 ${mailAttachments.value.length} 个附件` : ''
    mailStatusKind.value = files.length ? 'idle' : 'idle'
    inputElement.value = ''
  } catch (error) {
    mailStatus.value = `附件读取失败：${error instanceof Error ? error.message : '未知错误'}`
    mailStatusKind.value = 'error'
    inputElement.value = ''
  }
}

// 将单个 File 读取为邮件附件 payload。
async function readMailAttachment(file: File): Promise<MailAttachmentPayload> {
  const buffer = await file.arrayBuffer()

  return {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    bytes: Array.from(new Uint8Array(buffer)),
  }
}

// 调用 Rust 后端读取最近邮件列表。
async function fetchMailInbox() {
  if (!isTauriRuntime()) {
    mailInboxStatus.value = '浏览器预览不能收取邮件'
    mailInboxStatusKind.value = 'error'
    return
  }

  try {
    mailInboxStatus.value = '收件箱刷新中'
    mailInboxStatusKind.value = 'loading'
    selectedMailInboxItem.value = null
    if (!mailConfig.value.authCode) {
      throw new Error('请先填写邮箱授权码')
    }
    mailInboxItems.value = await fetchMailInboxItems()
    mailInboxKnownIds = new Set(mailInboxItems.value.map((item) => item.id).filter(Boolean))
    mailInboxStatus.value = mailInboxItems.value.length
      ? `已读取最近 ${mailInboxItems.value.length} 封邮件`
      : '收件箱暂无邮件'
    mailInboxStatusKind.value = 'success'
  } catch (error) {
    mailInboxStatus.value = error instanceof Error ? error.message : String(error)
    mailInboxStatusKind.value = 'error'
  }
}

// 打开单封邮件详情，详情复用收件箱列表已读取的内容。
function openMailInboxDetail(item: MailInboxItem) {
  selectedMailInboxItem.value = item
}

// 从邮件详情返回收件箱列表。
function backToMailInboxList() {
  selectedMailInboxItem.value = null
}

// 将收件箱详情里的附件内容转换为 Blob 并触发浏览器下载。
async function downloadMailInboxAttachment(attachment: MailInboxAttachment) {
  const bytes = base64ToUint8Array(attachment.contentBase64)
  const blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' })

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: attachment.fileName || '附件',
        types: [
          {
            description: attachment.mimeType || '附件',
            accept: {
              [attachment.mimeType || 'application/octet-stream']: [fileExtensionFromName(attachment.fileName)],
            },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.fileName || '附件'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function fileExtensionFromName(fileName: string) {
  const match = /\.[^.]+$/.exec(fileName)
  return match ? match[0] : '.bin'
}

function base64ToUint8Array(value: string) {
  const binary = window.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function formatAttachmentSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size >= 1024) return `${Math.ceil(size / 1024)} KB`
  return `${size} B`
}

type MailInboxFetchOptions = {
  unreadOnly?: boolean
}

// 使用本地收件箱代理，避免旧 Tauri exe 中的 IMAP ID 解析问题。
async function fetchMailInboxItems(options: MailInboxFetchOptions = {}): Promise<MailInboxItem[]> {
  const items = await invoke<MailInboxItem[]>('fetch_mail_inbox', { config: mailConfig.value })
  if (options.unreadOnly) {
    return items.filter((item) => item.unread)
  }
  return items
}

function connectMailInboxEvents() {
  startMailInboxFallbackPolling()
}
function disconnectMailInboxEvents() {
  stopMailInboxFallbackPolling()
}

function startMailInboxFallbackPolling() {
  if (!isTauriRuntime() || mailInboxFallbackPollTimer !== undefined) return
  if (!mailConfig.value.authCode) return

  if (isMailPanelVisible.value) {
    mailInboxStatus.value = '正在使用应用内邮箱配置轮询未读提醒'
    mailInboxStatusKind.value = 'loading'
  }

  void pollMailInboxForNotifications()
  mailInboxFallbackPollTimer = window.setInterval(() => {
    void pollMailInboxForNotifications()
  }, mailInboxPollIntervalMs)
}

function stopMailInboxFallbackPolling() {
  if (mailInboxFallbackPollTimer === undefined) return

  window.clearInterval(mailInboxFallbackPollTimer)
  mailInboxFallbackPollTimer = undefined
}

async function pollMailInboxForNotifications() {
  if (!mailConfig.value.authCode) return

  try {
    const items = await invoke<MailInboxItem[]>('fetch_mail_inbox', { config: mailConfig.value })
    const newItems = items.filter((item) => item.id && !mailInboxKnownIds.has(item.id))
    for (const item of items) {
      if (item.id) mailInboxKnownIds.add(item.id)
    }

    if (mailInboxItems.value.length === 0) {
      mailInboxItems.value = items
      return
    }

    if (newItems.length) {
      showNewMailNotification(newItems)
    }
  } catch (error) {
    if (isMailPanelVisible.value) {
      mailInboxStatus.value = error instanceof Error ? error.message : String(error)
      mailInboxStatusKind.value = 'error'
    }
  }
}

function showNewMailNotification(items: MailInboxItem[]) {
  if (!items.length) return

  const existing = new Map(mailInboxItems.value.map((item) => [item.id, item]))
  for (const item of items) existing.set(item.id, item)
  mailInboxItems.value = Array.from(existing.values())
  selectedMailInboxItem.value = null
  mailInboxStatus.value = `收到 ${items.length} 封新邮件`
  mailInboxStatusKind.value = 'success'

  const firstSubject = items[0]?.subject?.trim()
  showBubble(firstSubject ? `收到 ${items.length} 封新邮件：${firstSubject}` : `收到 ${items.length} 封新邮件`, {
    persistent: true,
  })
}

// 从当前邮件附件列表中移除指定附件。
function removeMailAttachment(index: number) {
  mailAttachments.value = mailAttachments.value.filter((_, attachmentIndex) => attachmentIndex !== index)
  mailStatus.value = mailAttachments.value.length ? `已选择 ${mailAttachments.value.length} 个附件` : ''
  mailStatusKind.value = 'idle'

  if (mailFileInputElement.value) {
    mailFileInputElement.value.value = ''
  }
}

// 调用 Rust 后端发送邮件，并把发送结果展示到面板。
async function sendMail() {
  const payload = createMailPayload()
  if (!payload) return

  if (!isTauriRuntime()) {
    mailStatus.value = '浏览器预览不能发送邮件'
    mailStatusKind.value = 'error'
    return
  }

  if (mailScheduledAt.value) {
    scheduleMail(payload)
    return
  }

  try {
    mailStatus.value = '发送中'
    mailStatusKind.value = 'loading'
    await sendMailPayload(payload)
    mailStatus.value = '发送成功'
    mailStatusKind.value = 'success'
    clearMailDraft()
  } catch (error) {
    mailStatus.value = error instanceof Error ? error.message : String(error)
    mailStatusKind.value = 'error'
  }
}

function createMailPayload(): MailSendPayload | null {
  const to = mailTo.value.trim()
  const subject = mailSubject.value.trim()
  const body = mailBody.value
  const config = mailConfig.value
  const attachments = mailAttachments.value.map((attachment) => ({
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    bytes: [...attachment.bytes],
  }))

  if (!to) {
    mailStatus.value = '请填写收件人邮箱'
    mailStatusKind.value = 'error'
    return null
  }

  if (!subject) {
    mailStatus.value = '请填写邮件主题'
    mailStatusKind.value = 'error'
    return null
  }

  if (!config.authCode) {
    mailStatus.value = '请先填写邮箱授权码'
    mailStatusKind.value = 'error'
    return null
  }

  if (!body.trim() && !attachments.length) {
    mailStatus.value = '请填写正文或选择附件'
    mailStatusKind.value = 'error'
    return null
  }

  saveStoredValue('monthlySalaryCat.mail.to', to)
  return { to, subject, body, attachments, config }
}

function scheduleMail(payload: MailSendPayload) {
  if (scheduledMailTimer !== undefined) {
    mailStatus.value = '已有一封定时邮件等待发送，请先取消或等待发送完成'
    mailStatusKind.value = 'error'
    return
  }

  const scheduledTime = new Date(mailScheduledAt.value)
  const delay = scheduledTime.getTime() - Date.now()

  if (!Number.isFinite(delay) || delay <= 0) {
    mailStatus.value = '请选择未来的发送时间'
    mailStatusKind.value = 'error'
    return
  }

  if (delay > 2_147_483_647) {
    mailStatus.value = '定时时间不能超过 24 天'
    mailStatusKind.value = 'error'
    return
  }

  const scheduledLabel = formatScheduledMailTime(scheduledTime)
  scheduledMailSummary.value = `${scheduledLabel} 发送：${payload.subject}`
  scheduledMailTimer = window.setTimeout(() => {
    scheduledMailTimer = undefined
    void sendScheduledMail(payload, scheduledLabel)
  }, delay)

  mailStatus.value = `已定时：${scheduledMailSummary.value}`
  mailStatusKind.value = 'success'
  clearMailDraft()
}

async function sendScheduledMail(payload: MailSendPayload, scheduledLabel: string) {
  try {
    mailStatus.value = `定时邮件发送中：${payload.subject}`
    mailStatusKind.value = 'loading'
    await sendMailPayload(payload)
    mailStatus.value = `定时邮件已发送：${payload.subject}`
    mailStatusKind.value = 'success'
  } catch (error) {
    mailStatus.value = `定时邮件发送失败（${scheduledLabel}）：${error instanceof Error ? error.message : String(error)}`
    mailStatusKind.value = 'error'
  } finally {
    scheduledMailSummary.value = ''
  }
}

async function sendMailPayload(payload: MailSendPayload) {
  await withTimeout(
    invoke('send_mail', { payload }),
    mailSendTimeoutMs,
    '邮件发送超时，请检查网络或 SMTP 服务状态',
  )
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: number | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timeout !== undefined) {
      window.clearTimeout(timeout)
    }
  }
}

function cancelScheduledMail() {
  if (scheduledMailTimer === undefined) return

  window.clearTimeout(scheduledMailTimer)
  scheduledMailTimer = undefined
  scheduledMailSummary.value = ''
  mailStatus.value = '已取消定时发送'
  mailStatusKind.value = 'idle'
}

function clearMailDraft() {
  mailSubject.value = ''
  mailBody.value = ''
  mailScheduledAt.value = ''
  mailAttachments.value = []

  if (mailFileInputElement.value) {
    mailFileInputElement.value.value = ''
  }
}

function formatScheduledMailTime(date: Date) {
  return formatDateTimeLocalValue(date).replace('T', ' ')
}

// 从右键菜单隐藏当前窗口，之后仍可通过系统托盘唤醒。
async function hidePetWindow() {
  isContextMenuVisible.value = false
  closeReadingPanel()
  closeTranslationPanel()
  closeNewsPanel()
  closeMailPanel()

  if (!isTauriRuntime()) return

  try {
    await getCurrentWindow().hide()
  } catch (error) {
    console.warn('隐藏窗口失败', error)
  }
}

// 从右键菜单退出 Tauri 应用。
async function quitApp() {
  isContextMenuVisible.value = false

  if (!isTauriRuntime()) return

  try {
    await invoke('quit_app')
  } catch (error) {
    console.warn('退出应用失败', error)
  }
}

// 重新请求今日新闻，并防止旧请求覆盖新结果。
async function refreshNewsResult() {
  const requestId = Date.now()

  lastNewsRequestId = requestId
  newsResult.value = {
    status: 'loading',
    message: '新闻加载中',
    items: newsResult.value.items,
  }

  const result = await getTodayNews(newsSettings.value)

  // 用户连续刷新或切换配置时，只允许最后一次请求写回界面。
  if (lastNewsRequestId !== requestId) return

  newsResult.value = result
}

// 打开新闻原文链接，Tauri 环境下交给系统默认浏览器。
async function openNewsUrl(url: string) {
  if (!url) return

  if (!isTauriRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  try {
    // Tauri WebView 的普通 target="_blank" 不稳定，显式交给系统浏览器。
    await invoke('plugin:opener|open_url', { url, with: null })
  } catch (error) {
    console.warn('打开新闻链接失败', error)
  }
}

// 根据当前输入和配置刷新翻译结果，并处理异步乱序。
async function refreshTranslationResult() {
  const requestId = Date.now()
  const source = translationInput.value

  lastTranslationRequestId = requestId

  if (translationSettings.value.provider !== 'local' && source.trim()) {
    translationStatus.value = '翻译中'
  } else {
    translationStatus.value = ''
  }

  const result = await getTranslationResult(source, translationSettings.value)

  // 在线翻译可能慢于输入变化，旧请求不能覆盖新输入的结果。
  if (lastTranslationRequestId !== requestId) return

  translationResult.value = result
  translationStatus.value = ''
}

// 使用 Web Speech API 播放阅读面板中的当前输入。
function playReadingSpeech() {
  const text = readingResult.value.source

  if (!text) {
    speechStatus.value = '请输入后再播放'
    return
  }

  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    speechStatus.value = '当前环境不支持语音播放'
    return
  }

  window.speechSynthesis.cancel()

  // Web Speech 的具体发音由系统语音决定；这里只选择语言和语速。
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = readingResult.value.kind === 'english' ? 'en-US' : 'zh-CN'
  utterance.rate = readingResult.value.kind === 'english' ? 0.86 : 0.92
  utterance.onstart = () => {
    speechStatus.value = '播放中'
  }
  utterance.onend = () => {
    speechStatus.value = ''
  }
  utterance.onerror = () => {
    speechStatus.value = '播放失败'
  }

  window.speechSynthesis.speak(utterance)
}

// 停止当前语音播放。
function stopReadingSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

// 点击舞台空白处时关闭右键菜单。
function handleStageClick() {
  isContextMenuVisible.value = false
  if (isBubblePersistent.value) {
    hideBubble()
  }
}

// 处理全局 Esc：关闭菜单和所有工具面板。
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return

  isContextMenuVisible.value = false
  closeReadingPanel()
  closeTranslationPanel()
  closeNewsPanel()
  closeMailPanel()
}

let lastTranslationRequestId = 0
let lastNewsRequestId = 0

watch(
  [translationInput, translationProvider, baiduAppId, baiduKey, azureKey, azureRegion, deeplKey],
  () => {
    saveStoredValue('monthlySalaryCat.translation.provider', translationProvider.value)
    saveStoredValue('monthlySalaryCat.translation.baiduAppId', baiduAppId.value)
    saveStoredValue('monthlySalaryCat.translation.baiduKey', baiduKey.value)
    saveStoredValue('monthlySalaryCat.translation.azureKey', azureKey.value)
    saveStoredValue('monthlySalaryCat.translation.azureRegion', azureRegion.value)
    saveStoredValue('monthlySalaryCat.translation.deeplKey', deeplKey.value)
    void refreshTranslationResult()
  },
  { immediate: true },
)

watch([newsProvider, juheNewsKey, juheNewsCategory], () => {
  saveStoredValue('monthlySalaryCat.news.provider', newsProvider.value)
  saveStoredValue('monthlySalaryCat.news.juheKey', juheNewsKey.value)
  saveStoredValue('monthlySalaryCat.news.juheCategory', juheNewsCategory.value)
})

watch([mailTo, mailAuthCode, mailSmtpHost, mailImapHost], () => {
  saveStoredValue('monthlySalaryCat.mail.to', mailTo.value)
  saveStoredValue('monthlySalaryCat.mail.authCode', mailAuthCode.value)
  saveStoredValue('monthlySalaryCat.mail.smtpHost', mailSmtpHost.value)
  saveStoredValue('monthlySalaryCat.mail.imapHost', mailImapHost.value)
  stopMailInboxFallbackPolling()
  connectMailInboxEvents()
})

onMounted(() => {
  updateViewportSize()
  restorePetCanvasSize()
  scheduleNextGif()
  scheduleNextClockBubble()
  connectMailInboxEvents()
  window.addEventListener('mouseup', stopPress)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateViewportSize)
})

onBeforeUnmount(() => {
  stopReadingSpeech()
  window.clearTimeout(animationTimer)
  window.clearTimeout(bubbleTimer)
  window.clearTimeout(clockBubbleTimer)
  window.clearTimeout(scheduledMailTimer)
  disconnectMailInboxEvents()
  stopToolPanelResize()
  window.removeEventListener('mouseup', stopPress)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateViewportSize)
})
</script>

<template>
  <main
    class="pet-stage"
    @click="handleStageClick"
    @contextmenu.prevent.stop="openContextMenu"
    @mousedown.prevent="startDrag"
  >
    <div class="quote-bubble" :class="{ 'quote-bubble--visible': isBubbleVisible }">
      {{ bubbleText }}
    </div>

    <div
      v-if="isContextMenuVisible"
      ref="menuElement"
      class="pet-menu"
      :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
      @click.stop
      @mousedown.stop
    >
      <button type="button" class="pet-menu__item" @click="openReadingPanel">阅读</button>
      <button type="button" class="pet-menu__item" @click="openTranslationPanel">翻译</button>
      <button type="button" class="pet-menu__item" @click="openNewsPanel">新闻</button>
      <button type="button" class="pet-menu__item" @click="openMailPanel">邮件</button>
      <button type="button" class="pet-menu__item" @click="hidePetWindow">隐藏</button>
      <button type="button" class="pet-menu__item pet-menu__item--danger" @click="quitApp">退出</button>
    </div>

    <section
      v-if="isReadingPanelVisible"
      class="reading-panel"
      :style="toolPanelStyle"
      @click.stop
      @contextmenu.stop
      @mousedown="handleToolPanelMouseDown"
    >
      <div class="reading-panel__header">
        <span>阅读</span>
        <button type="button" class="reading-panel__close" aria-label="关闭阅读面板" @click="closeReadingPanel">
          ×
        </button>
      </div>
      <input
        ref="readingInputElement"
        v-model="readingInput"
        class="reading-panel__input"
        type="text"
        placeholder="输入中文或英文"
        @keydown.esc.prevent="closeReadingPanel"
        @keydown.stop
      />
      <div class="reading-panel__result" :class="`reading-panel__result--${readingResult.kind}`">
        <button type="button" class="reading-panel__play" aria-label="播放读音" title="播放读音" @click="playReadingSpeech">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 9v6h4l5 4V5L8 9H4Z" />
            <path d="M16 9.5a4 4 0 0 1 0 5" />
            <path d="M18.5 7a7 7 0 0 1 0 10" />
          </svg>
        </button>
        <p v-for="line in readingResult.lines" :key="line">{{ line }}</p>
        <p v-if="speechStatus" class="reading-panel__speech-status">{{ speechStatus }}</p>
      </div>
      <div class="tool-panel__resize" @mousedown.stop.prevent="startToolPanelResize"></div>
    </section>

    <section
      v-if="isTranslationPanelVisible"
      class="reading-panel translation-panel"
      :style="toolPanelStyle"
      @click.stop
      @contextmenu.stop
      @mousedown="handleToolPanelMouseDown"
    >
      <div class="reading-panel__header">
        <span>翻译</span>
        <button type="button" class="reading-panel__close" aria-label="关闭翻译面板" @click="closeTranslationPanel">
          ×
        </button>
      </div>
      <input
        ref="translationInputElement"
        v-model="translationInput"
        class="reading-panel__input"
        type="text"
        placeholder="输入英文或中文"
        @keydown.esc.prevent="closeTranslationPanel"
        @keydown.stop
      />
      <div class="translation-panel__settings">
        <select v-model="translationProvider" class="translation-panel__select" aria-label="翻译提供商">
          <option value="local">本地</option>
          <option value="mymemory">MyMemory</option>
          <option value="baidu">百度</option>
          <option value="azure">Azure</option>
          <option value="deepl">DeepL</option>
        </select>
        <input
          v-if="translationProvider === 'baidu'"
          v-model="baiduAppId"
          class="translation-panel__config"
          type="text"
          placeholder="百度 App ID"
          @keydown.stop
        />
        <input
          v-if="translationProvider === 'baidu'"
          v-model="baiduKey"
          class="translation-panel__config"
          type="password"
          placeholder="百度密钥"
          @keydown.stop
        />
        <input
          v-if="translationProvider === 'azure'"
          v-model="azureKey"
          class="translation-panel__config"
          type="password"
          placeholder="Azure 密钥"
          @keydown.stop
        />
        <input
          v-if="translationProvider === 'azure'"
          v-model="azureRegion"
          class="translation-panel__config"
          type="text"
          placeholder="Azure 区域"
          @keydown.stop
        />
        <input
          v-if="translationProvider === 'deepl'"
          v-model="deeplKey"
          class="translation-panel__config"
          type="password"
          placeholder="DeepL Key"
          @keydown.stop
        />
      </div>
      <div class="reading-panel__result" :class="`reading-panel__result--${translationResult.kind}`">
        <p v-for="line in translationResult.lines" :key="line">{{ line }}</p>
        <p v-if="translationStatus" class="reading-panel__speech-status">{{ translationStatus }}</p>
      </div>
      <div class="tool-panel__resize" @mousedown.stop.prevent="startToolPanelResize"></div>
    </section>

    <section
      v-if="isMailPanelVisible"
      class="reading-panel mail-panel"
      :style="toolPanelStyle"
      @click.stop
      @contextmenu.stop
      @mousedown="handleToolPanelMouseDown"
    >
      <div class="reading-panel__header">
        <span>邮件</span>
        <button type="button" class="reading-panel__close" aria-label="关闭邮件面板" @click="closeMailPanel">
          ×
        </button>
      </div>
      <div class="mail-panel__tabs" role="tablist" aria-label="邮件模式">
        <button
          type="button"
          class="mail-panel__tab"
          :class="{ 'mail-panel__tab--active': mailMode === 'send' }"
          @click="switchMailMode('send')"
        >
          发送
        </button>
        <button
          type="button"
          class="mail-panel__tab"
          :class="{ 'mail-panel__tab--active': mailMode === 'inbox' }"
          @click="switchMailMode('inbox')"
        >
          收件箱
        </button>
      </div>
      <div class="mail-panel__settings" aria-label="邮箱设置">
        <input
          v-model="mailAuthCode"
          class="translation-panel__config mail-panel__config"
          type="password"
          placeholder="163 邮箱授权码"
          autocomplete="off"
          @keydown.stop
        />
        <input
          v-model="mailSmtpHost"
          class="translation-panel__config mail-panel__config"
          type="text"
          placeholder="SMTP 主机"
          @keydown.stop
        />
        <input
          v-model="mailImapHost"
          class="translation-panel__config mail-panel__config"
          type="text"
          placeholder="IMAP 主机"
          @keydown.stop
        />
      </div>
      <template v-if="mailMode === 'send'">
        <input
          ref="mailToInputElement"
          v-model="mailTo"
          class="reading-panel__input"
          type="email"
          placeholder="收件人邮箱"
          @keydown.esc.prevent="closeMailPanel"
          @keydown.stop
        />
        <input
          v-model="mailSubject"
          class="reading-panel__input mail-panel__field"
          type="text"
          placeholder="主题"
          @keydown.stop
        />
        <textarea
          v-model="mailBody"
          class="mail-panel__body"
          placeholder="正文"
          @keydown.stop
        ></textarea>
        <input
          v-model="mailScheduledAt"
          class="reading-panel__input mail-panel__field"
          type="datetime-local"
          :min="minScheduledMailDateTime"
          aria-label="发送时间"
          title="发送时间，不填则立即发送"
          @keydown.stop
        />
        <input
          ref="mailFileInputElement"
          class="mail-panel__file"
          type="file"
          multiple
          @change="handleMailAttachmentChange"
          @keydown.stop
        />
        <div class="mail-panel__attachments">
          <span v-if="!mailAttachments.length">未选择附件</span>
          <div
            v-for="(attachment, index) in mailAttachments"
            :key="`${attachment.fileName}-${index}`"
            class="mail-panel__attachment"
          >
            <span>{{ attachment.fileName }}</span>
            <button
              type="button"
              class="mail-panel__attachment-remove"
              :aria-label="`移除附件 ${attachment.fileName}`"
              title="移除附件"
              @click="removeMailAttachment(index)"
            >
              ×
            </button>
          </div>
        </div>
        <div v-if="scheduledMailSummary" class="mail-panel__scheduled">
          <span>{{ scheduledMailSummary }}</span>
          <button
            type="button"
            class="mail-panel__scheduled-cancel"
            title="取消定时发送"
            @click="cancelScheduledMail"
          >
            取消
          </button>
        </div>
        <button
          type="button"
          class="news-panel__refresh"
          :disabled="mailStatusKind === 'loading'"
          @click="sendMail"
        >
          {{ mailSendButtonText }}
        </button>
        <div
          v-if="mailStatus"
          class="news-panel__status"
          :class="`news-panel__status--${mailStatusKind}`"
        >
          {{ mailStatus }}
        </div>
      </template>
      <template v-else>
        <template v-if="selectedMailInboxItem">
          <button type="button" class="news-panel__refresh" @click="backToMailInboxList">
            返回收件箱
          </button>
          <article class="mail-panel__inbox-detail">
            <h3>{{ selectedMailInboxItem.subject }}</h3>
            <p>{{ selectedMailInboxItem.from }}</p>
            <p v-if="selectedMailInboxItem.date">{{ selectedMailInboxItem.date }}</p>
            <div class="mail-panel__inbox-body">
              {{ selectedMailInboxItem.body || selectedMailInboxItem.preview || '无正文内容' }}
            </div>
            <div v-if="selectedMailInboxItem.attachments?.length" class="mail-panel__inbox-attachments">
              <h4>附件</h4>
              <div
                v-for="attachment in selectedMailInboxItem.attachments"
                :key="attachment.id"
                class="mail-panel__inbox-attachment"
              >
                <span>{{ attachment.fileName }} · {{ formatAttachmentSize(attachment.size) }}</span>
                <button
                  type="button"
                  class="mail-panel__inbox-download"
                  :aria-label="`下载附件 ${attachment.fileName}`"
                  @click="downloadMailInboxAttachment(attachment)"
                >
                  下载
                </button>
              </div>
            </div>
          </article>
        </template>
        <template v-else>
          <button
            type="button"
            class="news-panel__refresh"
            :disabled="mailInboxStatusKind === 'loading'"
            @click="fetchMailInbox"
          >
            刷新收件箱
          </button>
          <div class="news-panel__status" :class="`news-panel__status--${mailInboxStatusKind}`">
            {{ mailInboxStatus }}
          </div>
          <div class="mail-panel__inbox-list">
            <article
              v-for="item in mailInboxItems"
              :key="item.id"
              class="mail-panel__inbox-item"
              role="button"
              tabindex="0"
              @click="openMailInboxDetail(item)"
              @keydown.enter.prevent="openMailInboxDetail(item)"
              @keydown.space.prevent="openMailInboxDetail(item)"
            >
              <h3>{{ item.subject }}</h3>
              <p>{{ item.from }}</p>
              <p v-if="item.date">{{ item.date }}</p>
              <p>{{ item.preview || '无正文摘要' }}</p>
            </article>
          </div>
        </template>
      </template>
      <div class="tool-panel__resize" @mousedown.stop.prevent="startToolPanelResize"></div>
    </section>

    <section
      v-if="isNewsPanelVisible"
      class="reading-panel news-panel"
      :style="toolPanelStyle"
      @click.stop
      @contextmenu.stop
      @mousedown="handleToolPanelMouseDown"
    >
      <div class="reading-panel__header">
        <span>新闻</span>
        <button type="button" class="reading-panel__close" aria-label="关闭新闻面板" @click="closeNewsPanel">
          ×
        </button>
      </div>
      <div class="translation-panel__settings">
        <select v-model="newsProvider" class="translation-panel__select" aria-label="新闻来源">
          <option value="juhe">聚合数据</option>
        </select>
        <input
          v-model="juheNewsKey"
          class="translation-panel__config"
          type="password"
          placeholder="聚合数据 Key"
          @keydown.stop
        />
        <select
          v-model="juheNewsCategory"
          class="translation-panel__select"
          aria-label="新闻分类"
        >
          <option value="top">头条</option>
          <option value="guonei">国内</option>
          <option value="guoji">国际</option>
          <option value="caijing">财经</option>
          <option value="keji">科技</option>
          <option value="yule">娱乐</option>
          <option value="tiyu">体育</option>
        </select>
      </div>
      <button type="button" class="news-panel__refresh" @click="refreshNewsResult">
        刷新
      </button>
      <div class="news-panel__status" :class="`news-panel__status--${newsResult.status}`">
        {{ newsResult.message }}
      </div>
      <div class="news-panel__list">
        <article v-for="item in newsResult.items" :key="item.id" class="news-panel__item">
          <a
            v-if="item.url"
            class="news-panel__title"
            :href="item.url"
            target="_blank"
            rel="noreferrer"
            @click.prevent.stop="openNewsUrl(item.url)"
          >
            {{ item.title }}
          </a>
          <h3 v-else class="news-panel__title">{{ item.title }}</h3>
          <p class="news-panel__meta">{{ item.source }}<span v-if="item.time"> · {{ item.time }}</span></p>
          <p class="news-panel__summary">{{ item.summary }}</p>
        </article>
      </div>
      <div class="tool-panel__resize" @mousedown.stop.prevent="startToolPanelResize"></div>
    </section>

    <img
      v-if="currentGifUrl"
      class="salary-cat"
      :class="{ 'salary-cat--pressed': isPressed }"
      :src="currentGifUrl"
      alt="月薪喵桌面宠物"
      draggable="false"
    />
  </main>
</template>


