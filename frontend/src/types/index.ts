// ===== User Types =====
export interface User {
  id: string
  uid: string
  username: string
  nickname: string
  avatar: string
  email?: string
  phone?: string
  signature: string
  level: number
  exp: number
  coins: number
  following: number
  followers: number
  likes: number
  isVip: boolean
  vipType: 'month' | 'year' | 'none'
  createTime: string
  birthday?: string
  gender: 'male' | 'female' | 'secret'
}

export interface UserSimple {
  uid: string
  nickname: string
  avatar: string
  level: number
  isVip: boolean
  signature: string
}

export interface LoginForm {
  username: string
  password: string
  remember?: boolean
}

export interface RegisterForm {
  username: string
  password: string
  confirmPassword: string
  nickname: string
  email?: string
  phone?: string
  gender: 'male' | 'female' | 'secret'
  birthday?: string
  agreement: boolean
}

export interface AuthResponse {
  token: string
  refreshToken: string
  user: User
  expiresIn: number
}

// ===== Video Types =====
export interface Video {
  id: string
  bvid: string
  title: string
  description: string
  cover: string
  url: string
  duration: number
  durationFormatted: string
  category: Category
  tags: Tag[]
  author: UserSimple
  stats: VideoStats
  status: 'public' | 'private' | 'draft' | 'reviewing'
  createdAt: string
  updatedAt: string
  publishedAt: string
  quality: VideoQuality[]
}

export interface VideoSimple {
  id: string
  bvid: string
  title: string
  cover: string
  duration: number
  durationFormatted: string
  author: UserSimple
  stats: VideoStats
  createdAt: string
}

export interface VideoStats {
  views: number
  likes: number
  coins: number
  favorites: number
  shares: number
  replies: number
  danmakuCount: number
}

export interface VideoQuality {
  quality: number
  label: string
  url: string
}

export interface VideoForm {
  title: string
  description: string
  categoryId: string
  tags: string[]
  cover?: File
  video?: File
  status: 'public' | 'private' | 'draft'
}

// ===== Danmaku Types =====
export interface Danmaku {
  id: string
  videoId: string
  userId: string
  user?: UserSimple
  content: string
  time: number
  color: string
  type: DanmakuType
  fontSize: number
  createdAt: string
}

export type DanmakuType = 'scroll' | 'top' | 'bottom'

export interface DanmakuForm {
  content: string
  time: number
  color: string
  type: DanmakuType
  fontSize: number
}

export interface DanmakuSetting {
  opacity: number
  speed: number
  fontSize: number
  density: 'low' | 'medium' | 'high' | 'full'
  blockTypes: DanmakuType[]
  show: boolean
}

// ===== Comment Types =====
export interface Comment {
  id: string
  videoId: string
  userId: string
  user: UserSimple
  content: string
  parentId?: string
  rootId?: string
  replies: Comment[]
  replyCount: number
  likes: number
  isLiked: boolean
  createdAt: string
}

export interface CommentForm {
  content: string
  videoId: string
  parentId?: string
  rootId?: string
}

// ===== Category Types =====
export interface Category {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  parentId?: string
  children: Category[]
  sort: number
  videoCount: number
}

export interface Tag {
  id: string
  name: string
  slug: string
  count: number
}

// ===== Notification Types =====
export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  content: string
  isRead: boolean
  sourceId?: string
  sourceType?: string
  actor?: UserSimple
  createdAt: string
}

export type NotificationType =
  | 'reply'
  | 'like'
  | 'follow'
  | 'system'
  | 'video'
  | 'coin'
  | 'favorite'

export interface NotificationSettings {
  reply: boolean
  like: boolean
  follow: boolean
  system: boolean
  video: boolean
  email: boolean
  push: boolean
}

// ===== History Types =====
export interface WatchHistory {
  id: string
  video: VideoSimple
  userId: string
  progress: number
  duration: number
  watchedAt: string
}

// ===== Search Types =====
export interface SearchResult {
  videos: VideoSimple[]
  users: UserSimple[]
  total: number
  page: number
  pageSize: number
}

export interface SearchSuggestion {
  keyword: string
  highlight: string
  type: 'video' | 'user' | 'tag'
}

export interface HotSearch {
  rank: number
  keyword: string
  heat: number
  tag?: string
}

// ===== Pagination Types =====
export interface PaginationParams {
  page: number
  pageSize: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ===== Follow Types =====
export interface FollowRelation {
  id: string
  followerId: string
  followingId: string
  createdAt: string
  isMutual: boolean
}

// ===== Upload Types =====
export interface UploadChunk {
  chunk: Blob
  chunkIndex: number
  totalChunks: number
  uploadId: string
}

export interface UploadProgress {
  uploadId: string
  fileName: string
  progress: number
  speed: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  error?: string
}

// ===== Favorite Types =====
export interface FavoriteFolder {
  id: string
  userId: string
  name: string
  description: string
  isDefault: boolean
  isPublic: boolean
  videoCount: number
  cover?: string
  createdAt: string
  updatedAt: string
}

export interface FavoriteItem {
  id: string
  folderId: string
  video: VideoSimple
  addedAt: string
}

// ===== Feed Types =====
export interface FeedItem {
  id: string
  type: 'video' | 'dynamic' | 'recommend'
  video?: VideoSimple
  author?: UserSimple
  action?: string
  createdAt: string
}

// ===== Banner Types =====
export interface Banner {
  id: string
  title: string
  subtitle: string
  image: string
  link: string
  color: string
  sort: number
}

// ===== API Response Types =====
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

export interface ApiError {
  code: number
  message: string
  details?: Record<string, string[]>
}

// ===== Player Types =====
export interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playbackRate: number
  isFullscreen: boolean
  isWebFullscreen: boolean
  buffered: number
  quality: number
  showControls: boolean
}

// ===== Theme Types =====
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeSettings {
  mode: ThemeMode
  fontSize: 'small' | 'medium' | 'large'
  compactMode: boolean
}
