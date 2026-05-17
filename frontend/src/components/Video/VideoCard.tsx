import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { VideoSimple } from '@/types'
import { formatNumber, formatDuration } from '@/utils/format'
import { formatPublishTime } from '@/utils/time'

interface VideoCardProps {
  video: VideoSimple
  layout?: 'vertical' | 'horizontal'
  size?: 'small' | 'medium' | 'large'
  showDanmaku?: boolean
}

export function VideoCard({ video, layout = 'vertical', size = 'medium', showDanmaku = true }: VideoCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleImageLoad = useCallback(() => {
    setImgLoaded(true)
  }, [])

  if (layout === 'horizontal') {
    return (
      <Link
        to={`/video/${video.bvid}`}
        className="flex gap-3 group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-bili-bg">
          {!imgLoaded && <div className="absolute inset-0 skeleton" />}
          <img
            src={video.cover}
            alt={video.title}
            className={`w-full h-full object-cover transition-transform duration-500 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            } ${isHovered ? 'scale-105' : 'scale-100'}`}
            onLoad={handleImageLoad}
            loading="lazy"
          />
          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-medium tabular-nums">
            {video.durationFormatted || formatDuration(video.duration)}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 py-0.5">
          <h3 className="text-sm font-medium text-bili-text-primary line-clamp-2 group-hover:text-bili-pink transition-colors leading-snug">
            {video.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs text-bili-text-tertiary">{video.author.nickname}</span>
            {video.author.isVip && (
              <span className="px-1 py-0.5 bg-bili-pink text-white text-[9px] font-bold rounded leading-none">
                VIP
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-bili-text-tertiary">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2C4 2 2.5 3.5 2.5 5.5S4 9 6 10c2-.5 3.5-2 3.5-4.5S8 2 6 2z" fill="currentColor" opacity="0.5" />
                <circle cx="6" cy="5.5" r="1.5" fill="currentColor" />
              </svg>
              {formatNumber(video.stats.views)}
            </span>
            {showDanmaku && (
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="3" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="0.8" />
                  <path d="M3 6h6M3 7.5h4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
                </svg>
                {formatNumber(video.stats.danmakuCount)}
              </span>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // Vertical layout (default card)
  const isSmall = size === 'small'
  const isLarge = size === 'large'

  return (
    <Link
      to={`/video/${video.bvid}`}
      className="group block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-bili-bg ${
          isLarge ? 'aspect-[16/10]' : 'aspect-video'
        }`}
      >
        {!imgLoaded && <div className="absolute inset-0 skeleton" />}
        <img
          src={video.cover}
          alt={video.title}
          className={`w-full h-full object-cover transition-all duration-500 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          } ${isHovered ? 'scale-110' : 'scale-100'}`}
          onLoad={handleImageLoad}
          loading="lazy"
        />

        {/* Hover Overlay */}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M6 4l12 6-12 6V4z" fill="white" />
            </svg>
          </div>
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium tabular-nums">
          {video.durationFormatted || formatDuration(video.duration)}
        </div>

        {/* Stats Overlay */}
        <div
          className={`absolute bottom-2 left-2 flex items-center gap-2 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M6 2C4 2 2.5 3.5 2.5 5.5S4 9 6 10c2-.5 3.5-2 3.5-4.5S8 2 6 2z" fill="currentColor" opacity="0.5" />
              <circle cx="6" cy="5.5" r="1.5" fill="currentColor" />
            </svg>
            {formatNumber(video.stats.views)}
          </span>
          {showDanmaku && (
            <span className="flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="3" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="0.8" />
                <path d="M3 6h6M3 7.5h4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
              </svg>
              {formatNumber(video.stats.danmakuCount)}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className={`${isSmall ? 'mt-1.5' : 'mt-2.5'}`}>
        <h3
          className={`font-medium text-bili-text-primary group-hover:text-bili-pink transition-colors leading-snug ${
            isSmall ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'
          }`}
        >
          {video.title}
        </h3>

        <div className={`flex items-center gap-1.5 ${isSmall ? 'mt-1' : 'mt-2'}`}>
          <img
            src={video.author.avatar}
            alt={video.author.nickname}
            className={`rounded-full object-cover flex-shrink-0 ${isSmall ? 'w-4 h-4' : 'w-5 h-5'}`}
          />
          <span className={`text-bili-text-tertiary truncate ${isSmall ? 'text-[11px]' : 'text-xs'}`}>
            {video.author.nickname}
          </span>
          {video.author.isVip && (
            <span className="px-1 py-0.5 bg-bili-pink text-white text-[8px] font-bold rounded leading-none flex-shrink-0">
              VIP
            </span>
          )}
        </div>

        {!isSmall && (
          <div className="mt-1 flex items-center gap-2 text-xs text-bili-text-tertiary">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2C4 2 2.5 3.5 2.5 5.5S4 9 6 10c2-.5 3.5-2 3.5-4.5S8 2 6 2z" fill="currentColor" opacity="0.5" />
                <circle cx="6" cy="5.5" r="1.5" fill="currentColor" />
              </svg>
              {formatNumber(video.stats.views)}
            </span>
            <span>{formatPublishTime(video.createdAt)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

/**
 * Skeleton loader for video card
 */
export function VideoCardSkeleton({ layout = 'vertical' }: { layout?: 'vertical' | 'horizontal' }) {
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
 * Compact video card for sidebar
 */
export function VideoCardCompact({ video }: { video: VideoSimple }) {
  return (
    <Link to={`/video/${video.bvid}`} className="flex gap-2.5 group">
      <div className="relative flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden bg-bili-bg">
        <img
          src={video.cover}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded">
          {formatDuration(video.duration)}
        </div>
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <h4 className="text-xs font-medium text-bili-text-primary line-clamp-2 group-hover:text-bili-pink transition-colors leading-snug">
          {video.title}
        </h4>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-bili-text-tertiary">
          <span>{video.author.nickname}</span>
          <span className="mx-0.5">·</span>
          <span>{formatNumber(video.stats.views)}次观看</span>
        </div>
      </div>
    </Link>
  )
}
