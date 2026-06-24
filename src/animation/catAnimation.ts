export type CatAnimationName = 'idle' | 'blink' | 'typing'

export interface CatGifAsset {
  /** 动画分组。GIF 本身已经包含逐帧动画，这里只负责在不同 GIF 之间切换。 */
  name: CatAnimationName
  /** Vite 打包后的资源地址。 */
  url: string
  /** 当前 GIF 建议展示时长，单位毫秒。 */
  duration: number
}

const gifModules = import.meta.glob('../assets/pet-gifs/*.gif', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// 从 GIF 文件名中取出数字序号。
function gifNumber(path: string) {
  return Number(path.match(/(\d+)\.gif$/)?.[1] ?? 0)
}

// GIF 文件名用数字排序，后续按数字区间划分动画分组。
const allGifs = Object.entries(gifModules)
  .sort(([left], [right]) => gifNumber(left) - gifNumber(right))
  .map(([path, url]) => ({ number: gifNumber(path), url }))

// 按数字区间生成某个动画分组的 GIF 配置。
function byRange(name: CatAnimationName, start: number, end: number, duration: number): CatGifAsset[] {
  return allGifs
    .filter((gif) => gif.number >= start && gif.number <= end)
    .map((gif) => ({ name, url: gif.url, duration }))
}

export const catGifAnimations: Record<CatAnimationName, CatGifAsset[]> = {
  idle: byRange('idle', 1, 8, 16000),
  blink: byRange('blink', 9, 14, 16000),
  typing: byRange('typing', 15, 20, 16000),
}

// 按概率选择下一段动画分组。
export function pickNextAnimation(): CatAnimationName {
  const roll = Math.random()

  // 大部分时间保持 idle，少量穿插眨眼和打字，避免桌宠过于躁动。
  if (roll < 0.22) return 'blink'
  if (roll < 0.5) return 'typing'
  return 'idle'
}

// 从指定动画分组中选择一个 GIF。
export function pickGif(name: CatAnimationName, currentUrl?: string): CatGifAsset {
  const pool = catGifAnimations[name].length > 0 ? catGifAnimations[name] : allAvailableGifs()
  // 同一分组内尽量不连续播放同一个 GIF。
  const available = pool.length > 1 ? pool.filter((gif) => gif.url !== currentUrl) : pool

  return available[Math.floor(Math.random() * available.length)]
}

// 当某个分组没有资源时，回退到所有可用 GIF。
function allAvailableGifs(): CatGifAsset[] {
  return allGifs.map((gif) => ({ name: 'idle', url: gif.url, duration: 2200 }))
}
