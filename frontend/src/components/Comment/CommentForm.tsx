import { useState, useCallback, useRef, useEffect } from 'react'
import { useVideoStore } from '@/stores/videoStore'
import { useAuthStore } from '@/stores/authStore'

interface CommentFormProps {
  videoId: string
  parentId?: string
  replyTo?: { id: string; username: string } | null
  onCancelReply?: () => void
  onSubmit?: () => void
}

export function CommentForm({ videoId, parentId, replyTo, onCancelReply, onSubmit }: CommentFormProps) {
  const { addComment } = useVideoStore()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus when replying
  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [replyTo])

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || isSubmitting) return

    if (trimmed.length < 2) {
      alert('评论内容太短了')
      return
    }
    if (trimmed.length > 1000) {
      alert('评论内容不能超过1000字')
      return
    }

    setIsSubmitting(true)
    try {
      await addComment(videoId, trimmed, parentId || replyTo?.id)
      setContent('')
      onSubmit?.()
    } catch (error: unknown) {
      const err = error as { message?: string }
      alert(err?.message || '评论失败')
    } finally {
      setIsSubmitting(false)
    }
  }, [content, isSubmitting, videoId, parentId, replyTo, addComment, onSubmit])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-bili-bg rounded-xl p-6 text-center">
        <p className="text-sm text-bili-text-tertiary mb-3">登录后才能发表评论</p>
        <a
          href="/login"
          className="inline-flex items-center px-5 py-2 bg-bili-pink text-white text-sm font-medium rounded-lg hover:bg-bili-pink-dark transition-colors"
        >
          登录
        </a>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0 hidden sm:block">
        <img
          src={user?.avatar || '/default-avatar.png'}
          alt={user?.nickname || '用户'}
          className="w-10 h-10 rounded-full object-cover"
        />
      </div>

      {/* Input Area */}
      <div className="flex-1">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-bili-pink-light rounded-lg">
            <span className="text-xs text-bili-pink">
              回复 <span className="font-medium">@{replyTo.username}</span>
            </span>
            <button
              onClick={onCancelReply}
              className="ml-auto text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors"
            >
              取消
            </button>
          </div>
        )}

        <div
          className={`relative border rounded-xl transition-all ${
            focused ? 'border-bili-pink shadow-sm ring-1 ring-bili-pink/10' : 'border-bili-border'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? `回复 @${replyTo.username}...` : '发一条友善的评论吧~'}
            maxLength={1000}
            rows={focused || content ? 3 : 2}
            className="w-full px-4 py-3 bg-transparent text-sm text-bili-text-primary placeholder-bili-text-tertiary outline-none resize-none rounded-xl"
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-bili-border-light">
            <div className="flex items-center gap-1">
              {/* Emoji Button */}
              <button
                type="button"
                className="p-1.5 rounded-lg text-bili-text-tertiary hover:bg-bili-bg hover:text-bili-text-primary transition-colors"
                title="表情"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="6.5" cy="7.5" r="1" fill="currentColor" />
                  <circle cx="11.5" cy="7.5" r="1" fill="currentColor" />
                  <path d="M6.5 11a3 3 0 005 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>

              {/* Image Button */}
              <button
                type="button"
                className="p-1.5 rounded-lg text-bili-text-tertiary hover:bg-bili-bg hover:text-bili-text-primary transition-colors"
                title="图片"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="6" cy="7" r="1.5" fill="currentColor" />
                  <path d="M2 13l4-4 3 3 3-2 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Mention Button */}
              <button
                type="button"
                className="p-1.5 rounded-lg text-bili-text-tertiary hover:bg-bili-bg hover:text-bili-text-primary transition-colors"
                title="@用户"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M9 5v5.5a1.5 1.5 0 001.5 1.5H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Character Count */}
              <span
                className={`text-xs transition-colors ${
                  content.length > 900 ? 'text-orange-400' : 'text-bili-text-tertiary'
                }`}
              >
                {content.length}/1000
              </span>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
                className="px-5 py-1.5 bg-bili-pink text-white text-sm font-medium rounded-lg hover:bg-bili-pink-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    发送中
                  </>
                ) : (
                  '发送'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tip */}
        <p className="mt-1.5 text-xs text-bili-text-tertiary">
          {focused ? '按 Ctrl + Enter 快速发送' : ''}
        </p>
      </div>
    </div>
  )
}
