import { useCallback, useEffect, useState, useRef } from 'react'
import { useVideoStore } from '@/stores/videoStore'
import type { Video, VideoSimple, PlayerState, VideoQuality } from '@/types'

/**
 * Video player hook
 */
export function useVideoPlayer(videoId: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    playbackRate: 1,
    isFullscreen: false,
    isWebFullscreen: false,
    buffered: 0,
    quality: 80,
    showControls: true,
  })
  const [qualities, setQualities] = useState<VideoQuality[]>([])
  const [currentQuality, setCurrentQuality] = useState<VideoQuality | null>(null)
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [playbackRates] = useState([0.5, 0.75, 1, 1.25, 1.5, 2])
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { currentVideo, fetchVideo, likeVideo, coinVideo, favoriteVideo, isLoading } = useVideoStore()

  // Fetch video on mount
  useEffect(() => {
    fetchVideo(videoId)
  }, [videoId, fetchVideo])

  // Update quality list when video loads
  useEffect(() => {
    if (currentVideo?.quality && currentVideo.quality.length > 0) {
      setQualities(currentVideo.quality)
      setCurrentQuality(currentVideo.quality[0])
    }
  }, [currentVideo])

  // Play/Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play().catch(console.error)
    } else {
      video.pause()
    }
  }, [])

  // Seek
  const seek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(time, video.duration || 0))
  }, [])

  // Set volume
  const setVolume = useCallback((volume: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = Math.max(0, Math.min(volume, 1))
    setPlayerState((prev) => ({ ...prev, volume, isMuted: volume === 0 }))
  }, [])

  // Toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setPlayerState((prev) => ({ ...prev, isMuted: video.muted }))
  }, [])

  // Set playback rate
  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
    setPlayerState((prev) => ({ ...prev, playbackRate: rate }))
  }, [])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = videoRef.current?.parentElement
    if (!container) return

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(console.error)
    } else {
      document.exitFullscreen().catch(console.error)
    }
  }, [])

  // Toggle web fullscreen (fills the window without OS fullscreen)
  const toggleWebFullscreen = useCallback(() => {
    setPlayerState((prev) => ({ ...prev, isWebFullscreen: !prev.isWebFullscreen }))
  }, [])

  // Change quality
  const changeQuality = useCallback(
    (quality: VideoQuality) => {
      const video = videoRef.current
      if (!video) return

      const currentTime = video.currentTime
      const wasPlaying = !video.paused

      setCurrentQuality(quality)
      setPlayerState((prev) => ({ ...prev, quality: quality.quality }))

      video.src = quality.url
      video.currentTime = currentTime
      if (wasPlaying) {
        video.play().catch(console.error)
      }
      setShowQualityMenu(false)
    },
    []
  )

  // Show controls temporarily
  const showControlsTemporarily = useCallback(() => {
    setPlayerState((prev) => ({ ...prev, showControls: true }))
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playerState.isPlaying) {
        setPlayerState((prev) => ({ ...prev, showControls: false }))
      }
    }, 3000)
  }, [playerState.isPlaying])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      setPlayerState((prev) => ({ ...prev, isPlaying: true }))
      showControlsTemporarily()
    }

    const handlePause = () => {
      setPlayerState((prev) => ({ ...prev, isPlaying: false, showControls: true }))
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }

    const handleTimeUpdate = () => {
      setPlayerState((prev) => ({
        ...prev,
        currentTime: video.currentTime,
        buffered: video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0,
      }))
    }

    const handleDurationChange = () => {
      setPlayerState((prev) => ({ ...prev, duration: video.duration }))
    }

    const handleVolumeChange = () => {
      setPlayerState((prev) => ({
        ...prev,
        volume: video.volume,
        isMuted: video.muted,
      }))
    }

    const handleFullscreenChange = () => {
      setPlayerState((prev) => ({ ...prev, isFullscreen: !!document.fullscreenElement }))
    }

    const handleEnded = () => {
      setPlayerState((prev) => ({ ...prev, isPlaying: false, showControls: true }))
    }

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setPlayerState((prev) => ({
          ...prev,
          buffered: video.buffered.end(video.buffered.length - 1),
        }))
      }
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('volumechange', handleVolumeChange)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('progress', handleProgress)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('volumechange', handleVolumeChange)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('progress', handleProgress)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [showControlsTemporarily])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(playerState.currentTime - 5)
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(playerState.currentTime + 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(playerState.volume + 0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(playerState.volume - 0.1)
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'j':
          e.preventDefault()
          seek(playerState.currentTime - 10)
          break
        case 'l':
          e.preventDefault()
          seek(playerState.currentTime + 10)
          break
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault()
          const percent = parseInt(e.key) * 10
          seek((playerState.duration * percent) / 100)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    togglePlay,
    seek,
    setVolume,
    toggleFullscreen,
    toggleMute,
    playerState.currentTime,
    playerState.duration,
    playerState.volume,
  ])

  return {
    // Refs
    videoRef,

    // State
    playerState,
    currentVideo,
    isLoading,
    qualities,
    currentQuality,
    showQualityMenu,
    showSettings,
    playbackRates,

    // Actions
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
    toggleWebFullscreen,
    changeQuality,
    showControlsTemporarily,
    likeVideo: () => likeVideo(videoId),
    coinVideo: (count: number) => coinVideo(videoId, count),
    favoriteVideo: (folderId?: string) => favoriteVideo(videoId, folderId),
    setShowQualityMenu,
    setShowSettings,
  }
}

/**
 * Hook for video feed with infinite scroll
 */
export function useVideoFeed(category?: string) {
  const {
    feedVideos,
    fetchFeedVideos,
    isLoading,
    hasMore,
    currentPage,
  } = useVideoStore()

  const [activeCategory, setActiveCategory] = useState(category || 'recommend')

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchFeedVideos({
        category: activeCategory,
        page: currentPage + 1,
      })
    }
  }, [isLoading, hasMore, currentPage, activeCategory, fetchFeedVideos])

  const changeCategory = useCallback(
    (cat: string) => {
      setActiveCategory(cat)
      useVideoStore.setState({ currentPage: 1, feedVideos: [] })
      fetchFeedVideos({ category: cat, page: 1 })
    },
    [fetchFeedVideos]
  )

  useEffect(() => {
    fetchFeedVideos({ category: activeCategory, page: 1 })
  }, [])

  return {
    videos: feedVideos,
    isLoading,
    hasMore,
    activeCategory,
    loadMore,
    changeCategory,
  }
}

/**
 * Hook for video list operations
 */
export function useVideoList() {
  const {
    recommendVideos,
    favoriteVideos,
    historyVideos,
    fetchRecommendVideos,
    fetchFavoriteVideos,
    fetchHistoryVideos,
  } = useVideoStore()

  const loadRecommend = useCallback(() => {
    fetchRecommendVideos()
  }, [fetchRecommendVideos])

  const loadFavorites = useCallback(() => {
    fetchFavoriteVideos()
  }, [fetchFavoriteVideos])

  const loadHistory = useCallback(() => {
    fetchHistoryVideos()
  }, [fetchHistoryVideos])

  return {
    recommendVideos,
    favoriteVideos,
    historyVideos,
    loadRecommend,
    loadFavorites,
    loadHistory,
  }
}

/**
 * Hook for video actions (like, coin, favorite, share)
 */
export function useVideoActions(videoId: string) {
  const {
    likeVideo,
    coinVideo,
    favoriteVideo,
    shareVideo,
    currentVideo,
  } = useVideoStore()

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const executeAction = useCallback(
    async (action: string, executor: () => Promise<void>) => {
      setActionLoading((prev) => ({ ...prev, [action]: true }))
      try {
        await executor()
      } finally {
        setActionLoading((prev) => ({ ...prev, [action]: false }))
      }
    },
    []
  )

  const handleLike = useCallback(async () => {
    await executeAction('like', () => likeVideo(videoId))
  }, [executeAction, likeVideo, videoId])

  const handleCoin = useCallback(
    async (count: number) => {
      await executeAction('coin', () => coinVideo(videoId, count))
    },
    [executeAction, coinVideo, videoId]
  )

  const handleFavorite = useCallback(
    async (folderId?: string) => {
      await executeAction('favorite', () => favoriteVideo(videoId, folderId))
    },
    [executeAction, favoriteVideo, videoId]
  )

  const handleShare = useCallback(async () => {
    await executeAction('share', () => shareVideo(videoId))
    // Copy link to clipboard
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = window.location.href
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }, [executeAction, shareVideo, videoId])

  return {
    stats: currentVideo?.stats,
    actionLoading,
    handleLike,
    handleCoin,
    handleFavorite,
    handleShare,
  }
}
