import { useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { get, post } from '@/api/client'

interface FollowButtonProps {
  uid: string
  initialFollowed?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'outline'
  className?: string
}

export function FollowButton({
  uid,
  initialFollowed = false,
  size = 'md',
  variant = 'primary',
  className = '',
}: FollowButtonProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const currentUser = useAuthStore((state) => state.user)

  const [isFollowing, setIsFollowing] = useState(initialFollowed)
  const [isLoading, setIsLoading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Check if it's self
  if (currentUser?.uid === uid) {
    return (
      <span
        className={`inline-flex items-center justify-center px-3 py-1.5 border border-bili-border text-bili-text-tertiary text-xs font-medium rounded-lg cursor-default ${className}`}
      >
        自己
      </span>
    )
  }

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm',
    lg: 'px-6 py-2 text-sm',
  }

  const handleToggle = useCallback(async () => {
    if (!isAuthenticated) {
      // Redirect to login
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      return
    }

    if (isLoading) return
    setIsLoading(true)

    try {
      if (isFollowing) {
        await post(`/users/${uid}/unfollow`, {})
        setIsFollowing(false)
      } else {
        await post(`/users/${uid}/follow`, {})
        setIsFollowing(true)
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      console.error('Follow action failed:', err?.message)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, isFollowing, isLoading, uid])

  if (isFollowing) {
    return (
      <button
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isLoading}
        className={`inline-flex items-center justify-center gap-1.5 border rounded-lg font-medium transition-all ${
          isHovered
            ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
            : 'border-bili-border bg-white text-bili-text-secondary hover:border-bili-text-tertiary'
        } ${sizeClasses[size]} ${isLoading ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      >
        {isLoading ? (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : isHovered ? (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M10 4L4 10M4 4l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            取消关注
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            已关注
          </>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all ${
        variant === 'primary'
          ? 'bg-bili-pink text-white hover:bg-bili-pink-dark'
          : 'border border-bili-pink text-bili-pink hover:bg-bili-pink-light'
      } ${sizeClasses[size]} ${isLoading ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    >
      {isLoading ? (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          关注
        </>
      )}
    </button>
  )
}

/**
 * Follow stats display
 */
export function FollowStats({
  following,
  followers,
  showMutual = false,
  isMutual = false,
}: {
  following: number
  followers: number
  showMutual?: boolean
  isMutual?: boolean
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1">
        <span className="font-semibold text-bili-text-primary">{following}</span>
        <span className="text-bili-text-tertiary">关注</span>
      </div>
      <div className="w-px h-3 bg-bili-border" />
      <div className="flex items-center gap-1">
        <span className="font-semibold text-bili-text-primary">{followers}</span>
        <span className="text-bili-text-tertiary">粉丝</span>
      </div>
      {showMutual && isMutual && (
        <>
          <div className="w-px h-3 bg-bili-border" />
          <span className="text-xs text-bili-pink font-medium">互相关注</span>
        </>
      )}
    </div>
  )
}

/**
 * User level badge
 */
export function LevelBadge({ level, exp, showProgress = false }: { level: number; exp?: number; showProgress?: boolean }) {
  const color = getLevelColor(level)
  const bgColor = getLevelBgColor(level)

  return (
    <div className="inline-flex items-center gap-1">
      <span
        className="px-1.5 py-0.5 text-[10px] font-bold rounded"
        style={{ color, backgroundColor: bgColor }}
      >
        Lv{level}
      </span>
      {showProgress && exp !== undefined && (
        <div className="w-16 h-1 bg-bili-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(exp % 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      )}
    </div>
  )
}

// Import needed function
function getLevelColor(level: number): string {
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

function getLevelBgColor(level: number): string {
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
