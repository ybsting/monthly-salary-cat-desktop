import { invoke } from '@tauri-apps/api/core'

export type NewsProvider = 'juhe'

export interface NewsSettings {
  provider: NewsProvider
  juheKey: string
  juheCategory: string
}

export interface NewsItem {
  id: string
  title: string
  source: string
  time: string
  summary: string
  url: string
}

export interface NewsResult {
  status: 'empty' | 'loading' | 'ready' | 'error'
  message: string
  items: NewsItem[]
}

// 获取今日新闻，并将成功、空结果和错误统一包装成面板可消费的状态。
export async function getTodayNews(settings: NewsSettings): Promise<NewsResult> {
  try {
    const items = await fetchJuheNews(settings)

    if (!items.length) {
      return {
        status: 'empty',
        message: '今天暂未获取到新闻。',
        items: [],
      }
    }

    return {
      status: 'ready',
      message: `今日新闻 ${items.length} 条`,
      items,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '新闻获取失败',
      items: [],
    }
  }
}

// 请求聚合数据新闻接口，并转换为应用内部的 NewsItem 列表。
async function fetchJuheNews(settings: NewsSettings) {
  if (!settings.juheKey) {
    throw new Error('请填写聚合数据新闻 Key')
  }

  // 聚合数据返回多少条就展示多少条，列表高度交给面板内部滚动控制。
  const data = await requestJuheNews(settings.juheKey, settings.juheCategory || 'top')

  if (data.error_code) {
    throw new Error(data.reason || `新闻请求失败 ${data.error_code}`)
  }

  const rows = Array.isArray(data.result?.data) ? data.result.data : []

  return rows.map((item: JuheNewsItem, index: number) => ({
    id: item.uniquekey || item.url || `juhe-${index}`,
    title: item.title || '未命名新闻',
    source: item.author_name || '聚合数据',
    time: item.date || '',
    summary: item.category ? `分类: ${item.category}` : '点击标题查看详情',
    url: item.url || '',
  }))
}

// 根据运行环境选择 Tauri 后端代理或浏览器直接请求。
async function requestJuheNews(key: string, category: string): Promise<JuheNewsResponse> {
  if (isTauriRuntime()) {
    // Tauri 环境走 Rust 代理，避开 WebView 直接 fetch 的 CORS 限制。
    return invoke<JuheNewsResponse>('fetch_juhe_news', { key, category })
  }

  // 浏览器预览没有 Tauri invoke，只保留直接请求作为开发回退。
  const url = new URL('https://v.juhe.cn/toutiao/index')
  url.searchParams.set('type', category)
  url.searchParams.set('key', key)

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`新闻请求失败 ${response.status}`)
  }

  return response.json()
}

// 判断当前是否运行在 Tauri WebView 中。
function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

interface JuheNewsItem {
  uniquekey?: string
  title?: string
  date?: string
  category?: string
  author_name?: string
  url?: string
}

interface JuheNewsResponse {
  error_code?: number
  reason?: string
  result?: {
    data?: JuheNewsItem[]
  }
}
