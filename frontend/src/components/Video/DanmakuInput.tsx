import { useState, useCallback, useRef } from 'react'
import type { DanmakuType } from '@/types'
import { getDanmakuColors } from '@/utils/format'
import { useAuth } from '@/hooks/useAuth'

interface DanmakuInputProps {
  onSend: (content: string, color: string, type: DanmakuType, fontSize: number) => Promise<void>
  disabled?: boolean
}

export function DanmakuInput({ onSend, disabled = false }: DanmakuInputProps) {
  const { isAuthenticated } = useAuth()
  const [content, setContent] = useState('')
  const [color, setColor] = useState('#FFFFFF')
  const [type, setType] = useState<DanmakuType>('scroll')
  const [fontSize, setFontSize] = useState(20)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const colors = getDanmakuColors()

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending || disabled) return

    // Validation
    if (trimmed.length > 100) {
      alert('弹幕内容不能超过100字')
      return
    }

    // Content filter
    const forbiddenWords = ['脏话', 'spam', '广告']
    if (forbiddenWords.some((w) => trimmed.includes(w))) {
      alert('弹幕内容包含违规信息')
      return
    }

    setIsSending(true)
    try {
      await onSend(trimmed, color, type, fontSize)
      setContent('')
      inputRef.current?.focus()
    } catch (error: unknown) {
      const err = error as { message?: string }
      alert(err?.message || '发送失败')
    } finally {
      setIsSending(false)
    }
  }, [content, color, type, fontSize, isSending, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const typeOptions: { value: DanmakuType; label: string; icon: string }[] = [
    { value: 'scroll', label: '滚动', icon: '↔' },
    { value: 'top', label: '顶部', icon: '↑' },
    { value: 'bottom', label: '底部', icon: '↓' },
  ]

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center gap-3 py-3 px-4 bg-bili-header rounded-lg">
        <span className="text-sm text-white/50">登录后可以发送弹幕</span>
        <a href="/login" className="text-sm text-bili-pink hover:underline">
          去登录
        </a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-bili-header rounded-lg">
      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => {
            setShowColorPicker(!showColorPicker)
            setShowTypePicker(false)
          }}
          className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center transition-transform hover:scale-110"
          style={{ backgroundColor: color }}
          title="选择颜色"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2l1.5 3 3 .5-2 2 .5 3-3-1.5-3 1.5.5-3-2-2 3-.5L7 2z" fill={isLightColor(color) ? '#333' : 'white'} />
          </svg>
        </button>
        {showColorPicker && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-white rounded-xl shadow-lg border border-bili-border animate-slide-up z-20">
            <div className="grid grid-cols-3 gap-1.5">
              {colors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => {
                    setColor(c.value)
                    setShowColorPicker(false)
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c.value ? 'border-bili-text-primary scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Type Picker */}
      <div className="relative">
        <button
          onClick={() => {
            setShowTypePicker(!showTypePicker)
            setShowColorPicker(false)
          }}
          className="h-8 px-2.5 rounded-lg bg-white/10 text-white/70 text-xs font-medium hover:bg-white/20 transition-colors flex items-center gap-1"
        >
          {typeOptions.find((t) => t.value === type)?.label || '滚动'}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        {showTypePicker && (
          <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-bili-border overflow-hidden animate-slide-up z-20">
            {typeOptions.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setType(t.value)
                  setShowTypePicker(false)
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                  type === t.value ? 'bg-bili-pink-light text-bili-pink' : 'text-bili-text-primary hover:bg-bili-bg'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Size */}
      <div className="hidden sm:flex items-center gap-1">
        {[18, 20, 24].map((size) => (
          <button
            key={size}
            onClick={() => setFontSize(size)}
            className={`h-8 px-2 rounded-lg text-xs font-medium transition-colors ${
              fontSize === size
                ? 'bg-bili-pink text-white'
                : 'bg-white/10 text-white/50 hover:bg-white/20'
            }`}
          >
            {size === 18 ? '小' : size === 20 ? '中' : '大'}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setShowColorPicker(false)
            setShowTypePicker(false)
          }}
          maxLength={100}
          disabled={disabled || isSending}
          placeholder="发一条友善的弹幕吧~"
          className="w-full h-9 px-4 bg-white/10 text-white text-sm rounded-lg placeholder-white/30 outline-none focus:bg-white/15 transition-colors border border-transparent focus:border-bili-pink/50 disabled:opacity-50"
        />
        {content.length > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
            {content.length}/100
          </span>
        )}
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={!content.trim() || isSending || disabled}
        className="h-9 px-5 bg-bili-pink text-white text-sm font-medium rounded-lg hover:bg-bili-pink-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 flex-shrink-0"
      >
        {isSending ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 14l12-6L2 2v4.67L12 8 2 9.33V14z" fill="currentColor" />
            </svg>
            发送
          </>
        )}
      </button>
    </div>
  )
}

function isLightColor(color: string): boolean {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128
}
