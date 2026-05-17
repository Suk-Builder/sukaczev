/**
 * Format number to compact format (e.g. 12000 -> 1.2万)
 */
export function formatNumber(num: number): string {
  if (num === undefined || num === null) return '0'
  if (num < 1000) {
    return num.toString()
  }
  if (num < 10000) {
    return num.toLocaleString('zh-CN')
  }
  if (num < 100000000) {
    const wan = (num / 10000).toFixed(1)
    return `${parseFloat(wan)}万`
  }
  const yi = (num / 100000000).toFixed(1)
  return `${parseFloat(yi)}亿`
}

/**
 * Format duration in seconds to mm:ss or hh:mm:ss
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Format number with commas
 */
export function formatComma(num: number): string {
  return num.toLocaleString('zh-CN')
}

/**
 * Get level color based on user level (1-6)
 */
export function getLevelColor(level: number): string {
  const colors: Record<number, string> = {
    1: '#8BD47D',
    2: '#65C049',
    3: '#00A1D6',
    4: '#FB7299',
    5: '#E66C5A',
    6: '#FFD700',
  }
  return colors[level] || '#9499A0'
}

/**
 * Get level background color
 */
export function getLevelBgColor(level: number): string {
  const colors: Record<number, string> = {
    1: '#F0F9EF',
    2: '#E8F5E4',
    3: '#E6F4FA',
    4: '#FFECF1',
    5: '#FDEBE8',
    6: '#FFF8E1',
  }
  return colors[level] || '#F1F2F3'
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Extract video ID from BV string
 */
export function extractBvId(input: string): string | null {
  const match = input.match(/BV[0-9A-Za-z]{10}/)
  return match ? match[0] : null
}

/**
 * Generate random BV ID
 */
export function generateBvId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  let result = 'BV'
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Get danmaku color palette
 */
export function getDanmakuColors(): { value: string; label: string }[] {
  return [
    { value: '#FFFFFF', label: '白色' },
    { value: '#FB7299', label: '粉色' },
    { value: '#00A1D6', label: '蓝色' },
    { value: '#73C9E5', label: '浅蓝' },
    { value: '#FF6B6B', label: '红色' },
    { value: '#FFD93D', label: '黄色' },
    { value: '#6BCB77', label: '绿色' },
    { value: '#C084FC', label: '紫色' },
    { value: '#FF9F45', label: '橙色' },
  ]
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diff = now.getTime() - then.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  if (months < 12) return `${months}个月前`
  return `${years}年前`
}

/**
 * Format absolute date
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const hours = d.getHours().toString().padStart(2, '0')
  const mins = d.getMinutes().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${mins}`
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Deep clone
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Check if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

/**
 * Generate random nickname
 */
export function generateNickname(): string {
  const prefixes = ['快乐', '潇洒', '神秘', '炫酷', '萌萌', '超级', '无敌', '小小', '大', '老']
  const suffixes = ['猫咪', '狗狗', '兔子', '熊猫', '狐狸', '狮子', '老虎', '熊', '鸟', '鱼', '玩家', '旅行者', '探索者', '冒险家', '达人']
  return prefixes[Math.floor(Math.random() * prefixes.length)] + suffixes[Math.floor(Math.random() * suffixes.length)] + Math.floor(Math.random() * 1000)
}

// Re-export formatPublishTime from time utils
