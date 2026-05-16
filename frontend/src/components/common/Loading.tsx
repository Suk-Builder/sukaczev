import { useEffect, useRef } from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  className?: string
  text?: string
}

export function Loading({ size = 'md', color = '#FB7299', className = '', text }: LoadingProps) {
  const sizeMap = {
    sm: 20,
    md: 32,
    lg: 48,
    xl: 64,
  }

  const s = sizeMap[size]

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <svg
        width={s}
        height={s}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-spin"
      >
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="60 20"
          opacity="0.3"
        />
        <path
          d="M16 4a12 12 0 0112 12"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      {text && <span className="text-sm text-bili-text-tertiary">{text}</span>}
    </div>
  )
}

/**
 * Full page loading screen
 */
export function FullPageLoading({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-[150] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg width="48" height="48" viewBox="0 0 32 32" fill="none" className="animate-spin">
          <circle cx="16" cy="16" r="12" stroke="#FB7299" strokeWidth="4" strokeLinecap="round" strokeDasharray="60 20" opacity="0.3" />
          <path d="M16 4a12 12 0 0112 12" stroke="#FB7299" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-bili-text-tertiary">{text}</p>
      </div>
    </div>
  )
}

/**
 * Skeleton loading placeholder
 */
export function Skeleton({
  className = '',
  variant = 'rectangle',
}: {
  className?: string
  variant?: 'rectangle' | 'circle' | 'text'
}) {
  const baseClass = 'animate-pulse bg-bili-border'

  const variants = {
    rectangle: 'rounded-lg',
    circle: 'rounded-full',
    text: 'rounded h-4',
  }

  return <div className={`${baseClass} ${variants[variant]} ${className}`} />
}

/**
 * Skeleton card for video
 */
export function SkeletonVideoCard({ layout = 'vertical' }: { layout?: 'vertical' | 'horizontal' }) {
  if (layout === 'horizontal') {
    return (
      <div className="flex gap-3 animate-pulse">
        <div className="flex-shrink-0 w-40 aspect-video rounded-lg bg-bili-border" />
        <div className="flex-1 py-1 space-y-2">
          <div className="h-4 bg-bili-border rounded w-3/4" />
          <div className="h-3 bg-bili-border rounded w-1/2" />
          <div className="h-3 bg-bili-border rounded w-1/3" />
        </div>
      </div>
    )
  }

  return (
    <div className="animate-pulse">
      <div className="w-full aspect-video rounded-xl bg-bili-border" />
      <div className="mt-3 space-y-2">
        <div className="h-4 bg-bili-border rounded w-full" />
        <div className="h-3 bg-bili-border rounded w-2/3" />
        <div className="h-3 bg-bili-border rounded w-1/2" />
      </div>
    </div>
  )
}

/**
 * Skeleton for comment
 */
export function SkeletonComment() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-bili-border" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 bg-bili-border rounded w-24" />
        <div className="h-3 bg-bili-border rounded w-full" />
        <div className="h-3 bg-bili-border rounded w-2/3" />
      </div>
    </div>
  )
}

/**
 * Skeleton list
 */
export function SkeletonList({ count = 5, renderItem }: { count?: number; renderItem?: (index: number) => React.ReactNode }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) =>
        renderItem ? (
          <div key={i}>{renderItem(i)}</div>
        ) : (
          <SkeletonComment key={i} />
        )
      )}
    </div>
  )
}

/**
 * Loading dots animation
 */
export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

/**
 * Loading overlay for a section
 */
export function LoadingOverlay({ isLoading, children }: { isLoading: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
          <Loading size="lg" />
        </div>
      )}
    </div>
  )
}

/**
 * Progress loading bar
 */
export function ProgressBar({ progress, className = '' }: { progress: number; className?: string }) {
  return (
    <div className={`w-full h-1 bg-bili-bg rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-bili-pink rounded-full transition-all duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
  )
}

/**
 * Infinite scroll loading trigger
 */
export function InfiniteScrollTrigger({
  isLoading,
  hasMore,
  onLoadMore,
}: {
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasMore || isLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: '100px' }
    )

    const el = ref.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasMore, isLoading, onLoadMore])

  if (!hasMore) {
    return (
      <div className="py-6 text-center">
        <span className="text-xs text-bili-text-tertiary">已经到底啦</span>
      </div>
    )
  }

  return (
    <div ref={ref} className="py-6 flex items-center justify-center">
      {isLoading ? (
        <Loading size="sm" text="加载更多..." />
      ) : (
        <div className="w-6 h-6 border-2 border-bili-border border-t-bili-pink rounded-full animate-spin" />
      )}
    </div>
  )
}

// Missing import
import { useEffect, useRef } from 'react'
