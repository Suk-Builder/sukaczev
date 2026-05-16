import { create } from 'zustand'
import type { Video, VideoSimple, Danmaku, DanmakuSetting, Comment, Category } from '@/types'
import { get, post } from '@/api/client'

interface VideoState {
  // Current playing video
  currentVideo: Video | null
  isLoading: boolean
  error: string | null

  // Video lists
  feedVideos: VideoSimple[]
  recommendVideos: VideoSimple[]
  relatedVideos: VideoSimple[]
  categoryVideos: VideoSimple[]
  searchVideos: VideoSimple[]
  userVideos: VideoSimple[]
  favoriteVideos: VideoSimple[]
  historyVideos: VideoSimple[]

  // Danmaku
  danmakuList: Danmaku[]
  danmakuSettings: DanmakuSetting

  // Comments
  commentList: Comment[]
  commentTotal: number
  commentLoading: boolean

  // Categories
  categories: Category[]
  currentCategory: Category | null

  // Pagination
  hasMore: boolean
  currentPage: number
  pageSize: number

  // Player state
  playerState: {
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    isMuted: boolean
    playbackRate: number
    isFullscreen: boolean
  }

  // Actions
  setCurrentVideo: (video: Video | null) => void
  fetchVideo: (id: string) => Promise<void>
  fetchFeedVideos: (params?: Record<string, unknown>) => Promise<void>
  fetchRecommendVideos: () => Promise<void>
  fetchRelatedVideos: (videoId: string) => Promise<void>
  fetchCategoryVideos: (slug: string, params?: Record<string, unknown>) => Promise<void>
  fetchUserVideos: (uid: string, params?: Record<string, unknown>) => Promise<void>
  fetchFavoriteVideos: () => Promise<void>
  fetchHistoryVideos: () => Promise<void>
  likeVideo: (videoId: string) => Promise<void>
  coinVideo: (videoId: string, count: number) => Promise<void>
  favoriteVideo: (videoId: string, folderId?: string) => Promise<void>
  shareVideo: (videoId: string) => Promise<void>

  // Danmaku actions
  fetchDanmaku: (videoId: string) => Promise<void>
  addDanmaku: (danmaku: Danmaku) => void
  sendDanmaku: (videoId: string, data: { content: string; time: number; color: string; type: string; fontSize: number }) => Promise<void>
  updateDanmakuSettings: (settings: Partial<DanmakuSetting>) => void

  // Comment actions
  fetchComments: (videoId: string, page?: number) => Promise<void>
  addComment: (videoId: string, content: string, parentId?: string) => Promise<void>
  likeComment: (commentId: string) => Promise<void>

  // Category actions
  fetchCategories: () => Promise<void>
  setCurrentCategory: (category: Category | null) => void

  // Player actions
  setPlayerState: (state: Partial<VideoState['playerState']>) => void

  // Reset
  reset: () => void
}

const defaultDanmakuSettings: DanmakuSetting = {
  opacity: 1,
  speed: 1,
  fontSize: 20,
  density: 'medium',
  blockTypes: [],
  show: true,
}

const initialPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  playbackRate: 1,
  isFullscreen: false,
}

export const useVideoStore = create<VideoState>()((set, get) => ({
  // Initial state
  currentVideo: null,
  isLoading: false,
  error: null,

  feedVideos: [],
  recommendVideos: [],
  relatedVideos: [],
  categoryVideos: [],
  searchVideos: [],
  userVideos: [],
  favoriteVideos: [],
  historyVideos: [],

  danmakuList: [],
  danmakuSettings: { ...defaultDanmakuSettings },

  commentList: [],
  commentTotal: 0,
  commentLoading: false,

  categories: [],
  currentCategory: null,

  hasMore: true,
  currentPage: 1,
  pageSize: 20,

  playerState: { ...initialPlayerState },

  // Set current video
  setCurrentVideo: (video) => set({ currentVideo: video }),

  // Fetch video detail
  fetchVideo: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const video = await get<Video>(`/videos/${id}`)
      set({
        currentVideo: video,
        isLoading: false,
        playerState: {
          ...get().playerState,
          duration: video.duration,
        },
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err?.message || '获取视频失败', isLoading: false })
    }
  },

  // Fetch feed videos (homepage)
  fetchFeedVideos: async (params = {}) => {
    set({ isLoading: true })
    try {
      const { list, totalPages } = await get<{ list: VideoSimple[]; total: number; totalPages: number }>(
        '/videos/feed',
        { page: get().currentPage, pageSize: get().pageSize, ...params }
      )
      set({
        feedVideos: get().currentPage === 1 ? list : [...get().feedVideos, ...list],
        hasMore: get().currentPage < totalPages,
        isLoading: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err?.message || '获取视频列表失败', isLoading: false })
    }
  },

  // Fetch recommend videos
  fetchRecommendVideos: async () => {
    try {
      const { list } = await get<{ list: VideoSimple[] }>('/videos/recommend')
      set({ recommendVideos: list })
    } catch (error: unknown) {
      console.error('Failed to fetch recommend videos:', error)
    }
  },

  // Fetch related videos
  fetchRelatedVideos: async (videoId: string) => {
    try {
      const { list } = await get<{ list: VideoSimple[] }>(`/videos/${videoId}/related`)
      set({ relatedVideos: list })
    } catch (error: unknown) {
      console.error('Failed to fetch related videos:', error)
    }
  },

  // Fetch category videos
  fetchCategoryVideos: async (slug: string, params = {}) => {
    set({ isLoading: true })
    try {
      const { list, totalPages } = await get<{ list: VideoSimple[]; total: number; totalPages: number }>(
        `/categories/${slug}/videos`,
        { page: get().currentPage, pageSize: get().pageSize, ...params }
      )
      set({
        categoryVideos: get().currentPage === 1 ? list : [...get().categoryVideos, ...list],
        hasMore: get().currentPage < totalPages,
        isLoading: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err?.message || '获取分类视频失败', isLoading: false })
    }
  },

  // Fetch user videos
  fetchUserVideos: async (uid: string, params = {}) => {
    set({ isLoading: true })
    try {
      const { list } = await get<{ list: VideoSimple[] }>(`/users/${uid}/videos`, params)
      set({ userVideos: list, isLoading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err?.message || '获取用户视频失败', isLoading: false })
    }
  },

  // Fetch favorite videos
  fetchFavoriteVideos: async () => {
    try {
      const { list } = await get<{ list: VideoSimple[] }>('/users/me/favorites')
      set({ favoriteVideos: list })
    } catch (error: unknown) {
      console.error('Failed to fetch favorites:', error)
    }
  },

  // Fetch history videos
  fetchHistoryVideos: async () => {
    try {
      const { list } = await get<{ list: VideoSimple[] }>('/users/me/history')
      set({ historyVideos: list })
    } catch (error: unknown) {
      console.error('Failed to fetch history:', error)
    }
  },

  // Like video
  likeVideo: async (videoId: string) => {
    await post(`/videos/${videoId}/like`, {})
    const video = get().currentVideo
    if (video) {
      set({
        currentVideo: {
          ...video,
          stats: { ...video.stats, likes: video.stats.likes + 1 },
        },
      })
    }
  },

  // Coin video
  coinVideo: async (videoId: string, count: number) => {
    await post(`/videos/${videoId}/coin`, { count })
    const video = get().currentVideo
    if (video) {
      set({
        currentVideo: {
          ...video,
          stats: { ...video.stats, coins: video.stats.coins + count },
        },
      })
    }
  },

  // Favorite video
  favoriteVideo: async (videoId: string, folderId?: string) => {
    await post(`/videos/${videoId}/favorite`, { folderId })
    const video = get().currentVideo
    if (video) {
      set({
        currentVideo: {
          ...video,
          stats: { ...video.stats, favorites: video.stats.favorites + 1 },
        },
      })
    }
  },

  // Share video
  shareVideo: async (videoId: string) => {
    await post(`/videos/${videoId}/share`, {})
    const video = get().currentVideo
    if (video) {
      set({
        currentVideo: {
          ...video,
          stats: { ...video.stats, shares: video.stats.shares + 1 },
        },
      })
    }
  },

  // Fetch danmaku
  fetchDanmaku: async (videoId: string) => {
    try {
      const { list } = await get<{ list: Danmaku[] }>(`/videos/${videoId}/danmaku`)
      set({ danmakuList: list })
    } catch (error: unknown) {
      console.error('Failed to fetch danmaku:', error)
    }
  },

  // Add danmaku locally (from WebSocket)
  addDanmaku: (danmaku: Danmaku) => {
    set({ danmakuList: [...get().danmakuList, danmaku] })
  },

  // Send danmaku
  sendDanmaku: async (videoId: string, data) => {
    await post(`/videos/${videoId}/danmaku`, data)
  },

  // Update danmaku settings
  updateDanmakuSettings: (settings: Partial<DanmakuSetting>) => {
    set({
      danmakuSettings: { ...get().danmakuSettings, ...settings },
    })
  },

  // Fetch comments
  fetchComments: async (videoId: string, page = 1) => {
    set({ commentLoading: true })
    try {
      const { list, total } = await get<{ list: Comment[]; total: number }>(
        `/videos/${videoId}/comments`,
        { page, pageSize: 20 }
      )
      set({
        commentList: page === 1 ? list : [...get().commentList, ...list],
        commentTotal: total,
        commentLoading: false,
      })
    } catch (error: unknown) {
      console.error('Failed to fetch comments:', error)
      set({ commentLoading: false })
    }
  },

  // Add comment
  addComment: async (videoId: string, content: string, parentId?: string) => {
    const comment = await post<Comment>(`/videos/${videoId}/comments`, { content, parentId })
    if (parentId) {
      // Reply to existing comment
      const updateReplies = (comments: Comment[]): Comment[] => {
        return comments.map((c) => {
          if (c.id === parentId) {
            return { ...c, replies: [...c.replies, comment], replyCount: c.replyCount + 1 }
          }
          if (c.replies.length > 0) {
            return { ...c, replies: updateReplies(c.replies) }
          }
          return c
        })
      }
      set({ commentList: updateReplies(get().commentList) })
    } else {
      set({ commentList: [comment, ...get().commentList] })
    }
    set({ commentTotal: get().commentTotal + 1 })
  },

  // Like comment
  likeComment: async (commentId: string) => {
    await post(`/comments/${commentId}/like`, {})
    const updateLikes = (comments: Comment[]): Comment[] => {
      return comments.map((c) => {
        if (c.id === commentId) {
          return { ...c, likes: c.likes + 1, isLiked: true }
        }
        if (c.replies.length > 0) {
          return { ...c, replies: updateLikes(c.replies) }
        }
        return c
      })
    }
    set({ commentList: updateLikes(get().commentList) })
  },

  // Fetch categories
  fetchCategories: async () => {
    try {
      const { list } = await get<{ list: Category[] }>('/categories')
      set({ categories: list })
    } catch (error: unknown) {
      console.error('Failed to fetch categories:', error)
    }
  },

  // Set current category
  setCurrentCategory: (category) => set({ currentCategory: category }),

  // Set player state
  setPlayerState: (state) => {
    set({
      playerState: { ...get().playerState, ...state },
    })
  },

  // Reset state
  reset: () => {
    set({
      currentVideo: null,
      error: null,
      commentList: [],
      commentTotal: 0,
      danmakuList: [],
      playerState: { ...initialPlayerState },
    })
  },
}))
