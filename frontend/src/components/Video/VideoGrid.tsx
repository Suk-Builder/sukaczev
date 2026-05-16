import { useEffect, useRef, useCallback, useState } from 'react'
import type { VideoSimple } from '@/types'
import { VideoCard, VideoCardSkeleton } from './VideoCard'

interface VideoGridProps {
  videos: VideoSimple[]
  loading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  columns?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: string
}

const defaultColumns = {
  sm: 2,
  md: 3,
  lg: 4,
  xl: 5,
}

export function VideoGrid({
  videos,
  loading = false,
  hasMore = false,
  onLoadMore,
  columns = defaultColumns,
  gap = 'gap-4',
}: VideoGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set())

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )

    const el = loadMoreRef.current
    if (el) {
      observer.observe(el)
    }

    return () => {
      if (el) {
        observer.unobserve(el)
      }
    }
  }, [onLoadMore, hasMore, loading])

  // Intersection observer for lazy rendering
  const itemObserverRef = useRef<IntersectionObserver | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    itemObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-id')
          if (id && entry.isIntersecting) {
            setVisibleItems((prev) => new Set(prev).add(id))
          }
        })
      },
      { rootMargin: '100px' }
    )

    return () => {
      itemObserverRef.current?.disconnect()
    }
  }, [])

  const setItemRef = useCallback((el: HTMLDivElement | null, id: string) => {
    if (el) {
      itemRefs.current.set(id, el)
      itemObserverRef.current?.observe(el)
    }
  }, [])

  const colClasses = [
    columns.sm && `grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`,
  ]
    .filter(Boolean)
    .join(' ')

  // Generate skeleton count
  const skeletonCount = 10

  return (
    <div className="w-full">
      <div className={`grid ${colClasses} ${gap}`}>
        {videos.map((video, index) => (
          <div
            key={video.id}
            ref={(el) => setItemRef(el, video.id)}
            data-id={video.id}
            className="opacity-0 animate-fade-in"
            style={{ animationDelay: `${Math.min(index * 50, 500)}ms`, animationFillMode: 'forwards' }}
          >
            <VideoCard video={video} />
          </div>
        ))}

        {/* Skeleton loaders */}
        {loading &&
          Array.from({ length: skeletonCount }).map((_, i) => (
            <VideoCardSkeleton key={`skeleton-${i}`} />
          ))}
      </div>

      {/* Load More Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="w-full py-8 flex items-center justify-center">
          {loading ? (
            <div className="flex items-center gap-2 text-bili-text-tertiary">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">加载中...</span>
            </div>
          ) : (
            <div className="w-8 h-8 border-2 border-bili-border border-t-bili-pink rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* End of list */}
      {!hasMore && videos.length > 0 && (
        <div className="w-full py-8 text-center">
          <div className="inline-flex items-center gap-2 text-bili-text-tertiary text-sm">
            <span className="w-8 h-px bg-bili-border" />
            <span>已经到底啦</span>
            <span className="w-8 h-px bg-bili-border" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && videos.length === 0 && (
        <div className="w-full py-20 flex flex-col items-center justify-center text-bili-text-tertiary">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mb-4 opacity-30">
            <rect x="10" y="20" width="60" height="40" rx="4" stroke="currentColor" strokeWidth="3" />
            <circle cx="40" cy="40" r="10" stroke="currentColor" strokeWidth="3" />
            <path d="M32 38l8 4-8 4V38z" fill="currentColor" />
          </svg>
          <p className="text-base font-medium">暂无视频</p>
          <p className="text-sm mt-1 opacity-60">去浏览更多精彩内容吧</p>
        </div>
      )}
    </div>
  )
}

/**
 * Horizontal scrolling video list
 */
export function VideoHorizontalList({
  videos,
  title,
  action,
}: {
  videos: VideoSimple[]
  title?: string
  action?: { label: string; href: string }
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
    }
    return () => {
      if (el) {
        el.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
  }, [checkScroll, videos])

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const scrollAmount = el.clientWidth * 0.8
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }, [])

  return (
    <div className="relative">
      {/* Header */}
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-bold text-bili-text-primary">{title}</h2>}
          {action && (
            <a
              href={action.href}
              className="text-sm text-bili-text-tertiary hover:text-bili-pink transition-colors flex items-center gap-1"
            >
              {action.label}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>
      )}

      {/* Scroll buttons */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center border border-bili-border hover:bg-bili-bg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center border border-bili-border hover:bg-bili-bg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* List */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
      >
        {videos.map((video) => (
          <div key={video.id} className="flex-shrink-0 w-64">
            <VideoCard video={video} />
          </div>
        ))}
      </div>
    </div>
  )
}
