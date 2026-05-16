/**
 * Time utility functions for Sukačev
 */

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now()
}

/**
 * Parse date string to Date object
 */
export function parseDate(date: string | Date | number): Date {
  if (date instanceof Date) return date
  if (typeof date === 'number') return new Date(date)
  return new Date(date)
}

/**
 * Check if date is today
 */
export function isToday(date: string | Date): boolean {
  const d = parseDate(date)
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

/**
 * Check if date is yesterday
 */
export function isYesterday(date: string | Date): boolean {
  const d = parseDate(date)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  )
}

/**
 * Get day of week in Chinese
 */
export function getDayOfWeek(date: string | Date): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[parseDate(date).getDay()]
}

/**
 * Format time ago with more granularity
 */
export function timeAgo(date: string | Date): string {
  const now = Date.now()
  const then = parseDate(date).getTime()
  const diff = now - then

  if (diff < 0) return '未来'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 10) return '刚刚'
  if (seconds < 60) return `${seconds}秒前`
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (weeks < 4) return `${weeks}周前`
  if (months < 12) return `${months}个月前`
  if (years < 2) return '1年前'
  return `${years}年前`
}

/**
 * Format duration for watch history (e.g. "看到 03:24")
 */
export function formatWatchProgress(current: number, total: number): string {
  const formatted = formatDuration(current)
  const percent = Math.round((current / total) * 100)
  if (percent >= 95) return '已看完'
  return `看到 ${formatted}`
}

/**
 * Format duration in seconds to mm:ss or hh:mm:ss
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (hours > 0) parts.push(hours.toString().padStart(2, '0'))
  parts.push(mins.toString().padStart(2, '0'))
  parts.push(secs.toString().padStart(2, '0'))

  return parts.join(':')
}

/**
 * Format publish time for video
 * - Within 24h: relative time
 * - Within 7 days: "X天前"
 * - Same year: "MM-DD"
 * - Different year: "YYYY-MM-DD"
 */
export function formatPublishTime(date: string | Date): string {
  const d = parseDate(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days < 1) return timeAgo(date)
  if (days < 7) return `${days}天前`
  if (d.getFullYear() === now.getFullYear()) {
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
  }
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

/**
 * Sleep/delay utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Format ISO string to local string
 */
export function toLocalString(date: string | Date): string {
  return parseDate(date).toLocaleString('zh-CN')
}

/**
 * Get greeting based on hour
 */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/**
 * Countdown formatter (seconds to mm:ss)
 */
export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate video progress percentage
 */
export function calcProgress(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((current / total) * 100))
}

/**
 * Get start of day
 */
export function startOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

/**
 * Get end of day
 */
export function endOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Format time range (e.g. "2024-01-01 至 2024-01-31")
 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const startStr = typeof start === 'string' ? start.split('T')[0] : formatDate(start)
  const endStr = typeof end === 'string' ? end.split('T')[0] : formatDate(end)
  return `${startStr} 至 ${endStr}`
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Get relative date label
 */
export function getRelativeDateLabel(date: string | Date): string {
  if (isToday(date)) return '今天'
  if (isYesterday(date)) return '昨天'
  return getDayOfWeek(date)
}
