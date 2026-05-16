import { useRef, useEffect, useState, useCallback } from 'react'
import { useVideoPlayer } from '@/hooks/useVideo'
import { formatDuration, formatNumber } from '@/utils/format'

interface VideoPlayerProps {
  videoId: string
  src: string
  poster?: string
  title?: string
}

export function VideoPlayer({ videoId, src, poster, title }: VideoPlayerProps) {
  const {
    videoRef,
    playerState,
    qualities,
    currentQuality,
    showQualityMenu,
    showSettings,
    playbackRates,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
    changeQuality,
    showControlsTemporarily,
    setShowQualityMenu,
    setShowSettings,
  } = useVideoPlayer(videoId)

  const [hoverTime, setHoverTime] = useState(0)
  const [hoverPosition, setHoverPosition] = useState(0)
  const [showHoverTime, setShowHoverTime] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)

  // Progress bar hover
  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !playerState.duration) return
      const rect = progressRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setHoverTime(ratio * playerState.duration)
      setHoverPosition(ratio * 100)
      setShowHoverTime(true)
    },
    [playerState.duration]
  )

  // Progress bar click
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !playerState.duration) return
      const rect = progressRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      seek(ratio * playerState.duration)
    },
    [playerState.duration, seek]
  )

  // Drag handling
  const handleDragStart = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging || !progressRef.current || !playerState.duration) return
      const rect = progressRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      seek(ratio * playerState.duration)
    },
    [isDragging, playerState.duration, seek]
  )

  // Play/Pause toggle on click
  const handleVideoClick = () => {
    togglePlay()
    showControlsTemporarily()
  }

  // Progress percentage
  const progressPercent = playerState.duration
    ? (playerState.currentTime / playerState.duration) * 100
    : 0

  const bufferedPercent = playerState.duration
    ? (playerState.buffered / playerState.duration) * 100
    : 0

  return (
    <div
      className={`relative bg-black group select-none ${
        playerState.isFullscreen || playerState.isWebFullscreen
          ? 'fixed inset-0 z-[100]'
          : 'w-full aspect-video rounded-xl overflow-hidden'
      }`}
      onMouseMove={showControlsTemporarily}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain cursor-pointer"
        onClick={handleVideoClick}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Loading Spinner */}
      {!playerState.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-12 h-12 border-4 border-white/20 border-t-bili-pink rounded-full animate-spin" />
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
          playerState.showControls || !playerState.isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <div
          ref={progressRef}
          className="relative h-1.5 bg-white/20 cursor-pointer group/progress hover:h-2.5 transition-all"
          onClick={handleProgressClick}
          onMouseMove={(e) => {
            handleProgressHover(e)
            handleDrag(e)
          }}
          onMouseEnter={() => setShowHoverTime(true)}
          onMouseLeave={() => {
            setShowHoverTime(false)
            handleDragEnd()
          }}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        >
          {/* Buffered */}
          <div
            className="absolute inset-y-0 left-0 bg-white/30 transition-all"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* Played */}
          <div
            className="absolute inset-y-0 left-0 bg-bili-pink transition-all"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Hover Indicator */}
          {showHoverTime && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
              style={{ left: `${hoverPosition}%` }}
            />
          )}
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-bili-pink rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity -ml-1.5"
            style={{ left: `${progressPercent}%` }}
          />
          {/* Time Tooltip */}
          {showHoverTime && showHoverTime && (
            <div
              className="absolute -top-9 bg-black/90 text-white text-xs px-2 py-1 rounded -translate-x-1/2 pointer-events-none"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatDuration(hoverTime)}
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Left Controls */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
              className="text-white hover:text-bili-pink transition-colors"
            >
              {playerState.isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="7" y="6" width="4" height="16" rx="1" fill="currentColor" />
                  <rect x="17" y="6" width="4" height="16" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M8 5l18 9-18 9V5z" fill="currentColor" />
                </svg>
              )}
            </button>

            {/* Time Display */}
            <div className="text-white text-xs font-medium tabular-nums">
              <span>{formatDuration(playerState.currentTime)}</span>
              <span className="text-white/50 mx-1">/</span>
              <span className="text-white/50">{formatDuration(playerState.duration)}</span>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1 group/volume">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleMute()
                }}
                className="text-white hover:text-bili-pink transition-colors"
              >
                {playerState.isMuted || playerState.volume === 0 ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M1 7v6h3l5 4V3L4 7H1z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M14 6l4 4M18 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : playerState.volume > 0.5 ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M1 7v6h3l5 4V3L4 7H1z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14.5 6.5c1.2 1.2 1.2 5.8 0 7M17 4c2.5 2.5 2.5 9 0 11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M1 7v6h3l5 4V3L4 7H1z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M14.5 6.5c1.2 1.2 1.2 5.8 0 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={playerState.isMuted ? 0 : playerState.volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1 accent-bili-pink cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Quality Selector */}
            {qualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowQualityMenu(!showQualityMenu)
                    setShowSettings(false)
                  }}
                  className="text-white text-xs font-medium hover:text-bili-pink transition-colors px-2 py-1 border border-white/30 rounded"
                >
                  {currentQuality?.label || '自动'}
                </button>
                {showQualityMenu && (
                  <div
                    className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-sm rounded-lg py-1 min-w-[100px] shadow-xl border border-white/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {qualities.map((q) => (
                      <button
                        key={q.quality}
                        onClick={() => changeQuality(q)}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          currentQuality?.quality === q.quality
                            ? 'text-bili-pink bg-white/10'
                            : 'text-white/80 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Playback Speed */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSettings(!showSettings)
                  setShowQualityMenu(false)
                }}
                className="text-white text-xs font-medium hover:text-bili-pink transition-colors px-2 py-1 border border-white/30 rounded"
              >
                {playerState.playbackRate}x
              </button>
              {showSettings && (
                <div
                  className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-sm rounded-lg py-1 min-w-[80px] shadow-xl border border-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {playbackRates.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        playerState.playbackRate === rate
                          ? 'text-bili-pink bg-white/10'
                          : 'text-white/80 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Web Fullscreen */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                // toggleWebFullscreen
              }}
              className="text-white hover:text-bili-pink transition-colors"
              title="网页全屏"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 6V3h3M16 6V3h-3M2 12v3h3M16 12v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Fullscreen */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleFullscreen()
              }}
              className="text-white hover:text-bili-pink transition-colors"
              title="全屏"
            >
              {playerState.isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M6 2H3v3M12 2h3v3M6 16H3v-3M12 16h3v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2 5V2h3M16 5V2h-3M2 13v3h3M16 13v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Title overlay (when paused) */}
      {!playerState.isPlaying && title && (
        <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/60 to-transparent p-4">
          <h2 className="text-white text-sm font-medium line-clamp-1">{title}</h2>
        </div>
      )}
    </div>
  )
}
