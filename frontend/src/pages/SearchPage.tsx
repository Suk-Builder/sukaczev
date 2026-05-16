import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { VideoGrid } from '@/components/Video/VideoGrid'
import { UserCard } from '@/components/User/UserCard'
import type { VideoSimple, UserSimple } from '@/types'
import { formatNumber } from '@/utils/format'

const hotSearches = [
  { rank: 1, keyword: '原神', heat: 9820000 },
  { rank: 2, keyword: '鬼畜', heat: 7650000 },
  { rank: 3, keyword: '美食教程', heat: 6540000 },
  { rank: 4, keyword: 'ChatGPT', heat: 5430000 },
  { rank: 5, keyword: '音乐', heat: 4320000 },
  { rank: 6, keyword: '游戏实况', heat: 3890000 },
  { rank: 7, keyword: '舞蹈', heat: 3210000 },
  { rank: 8, keyword: '科技评测', heat: 2870000 },
  { rank: 9, keyword: '动漫推荐', heat: 2340000 },
  { rank: 10, keyword: '学习方法', heat: 1980000 },
]

const searchHistory = ['React教程', '美食制作', '原神攻略', '音乐推荐']

function generateSearchVideos(count: number, seed: string): VideoSimple[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `search-${seed}-${i}`,
    bvid: `BV1srch${i.toString().padStart(8, '0')}`,
    title: [
      '【4K超清】绝美风景纪录片，每一帧都是壁纸',
      '全网最详细教程！手把手教你从零开始',
      '这个视频会让你笑到停不下来',
      '震撼！这是我见过最厉害的表演',
      '沉浸式体验，戴上耳机效果更佳',
    ][i % 5] + ` - ${seed}`,
    cover: `https://picsum.photos/seed/search${seed}${i}/640/360`,
    duration: 120 + Math.floor(Math.random() * 600),
    durationFormatted: '',
    author: {
      uid: `user-${i % 20}`,
      nickname: ['小明', '张三', '美食达人', '科技前沿', '音乐博主'][i % 5],
      avatar: `https://picsum.photos/seed/searchavatar${i}/100/100`,
      level: (i % 6) + 1,
      isVip: i % 3 === 0,
      signature: '',
    },
    stats: {
      views: 10000 + Math.floor(Math.random() * 999000),
      likes: 1000 + Math.floor(Math.random() * 50000),
      coins: 100 + Math.floor(Math.random() * 10000),
      favorites: 500 + Math.floor(Math.random() * 20000),
      shares: 50 + Math.floor(Math.random() * 5000),
      replies: 200 + Math.floor(Math.random() * 8000),
      danmakuCount: 500 + Math.floor(Math.random() * 15000),
    },
    createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
  }))
}

const mockUsers: UserSimple[] = [
  { uid: 'user-1', nickname: '美食达人小王', avatar: 'https://picsum.photos/seed/u1/100/100', level: 5, isVip: true, signature: '专注美食制作与分享' },
  { uid: 'user-2', nickname: '科技前沿', avatar: 'https://picsum.photos/seed/u2/100/100', level: 4, isVip: false, signature: '最新科技资讯与评测' },
  { uid: 'user-3', nickname: '音乐博主', avatar: 'https://picsum.photos/seed/u3/100/100', level: 6, isVip: true, signature: '分享好音乐' },
]

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [searchQuery, setSearchQuery] = useState(query)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [videos, setVideos] = useState<VideoSimple[]>([])
  const [users, setUsers] = useState<UserSimple[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState<'all' | 'video' | 'user'>('all')
  const [sortBy, setSortBy] = useState<'relevance' | 'views' | 'time'>('relevance')
  const [duration, setDuration] = useState<'all' | 'short' | 'medium' | 'long'>('all')

  // Perform search
  useEffect(() => {
    if (!query) {
      setVideos([])
      setUsers([])
      return
    }
    setLoading(true)
    setPage(1)
    setHasMore(true)

    setTimeout(() => {
      setVideos(generateSearchVideos(20, query))
      setUsers(mockUsers)
      setLoading(false)
    }, 600)
  }, [query])

  // Search suggestions
  const handleQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      if (value.trim()) {
        setSuggestions([
          `${value} 相关视频`,
          `${value} 教程`,
          `${value} 合集`,
          `${value} 最新`,
        ])
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    },
    []
  )

  const handleSearch = useCallback(
    (q: string) => {
      if (!q.trim()) return
      setSearchParams({ q: q.trim() })
      setShowSuggestions(false)
    },
    [setSearchParams]
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      handleSearch(searchQuery)
    },
    [handleSearch, searchQuery]
  )

  const loadMore = useCallback(() => {
    if (loading || !hasMore || !query) return
    setLoading(true)
    setTimeout(() => {
      const newVideos = generateSearchVideos(10, `${query}-${page}`)
      setVideos((prev) => [...prev, ...newVideos])
      setPage((prev) => prev + 1)
      setLoading(false)
      if (page >= 5) setHasMore(false)
    }, 800)
  }, [loading, hasMore, query, page])

  // Filtered results
  const showVideos = filterType === 'all' || filterType === 'video'
  const showUsers = filterType === 'all' || filterType === 'user'

  return (
    <div className="min-h-screen">
      {/* Search Header */}
      <div className="bg-white rounded-xl p-6 shadow-card mb-6">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center border-2 border-bili-border rounded-xl focus-within:border-bili-pink transition-colors overflow-hidden">
            <svg className="ml-4 text-bili-text-tertiary" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M9 17A8 8 0 119 1a8 8 0 010 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => searchQuery && setShowSuggestions(true)}
              placeholder="搜索视频、UP主、番剧..."
              className="flex-1 px-3 py-3.5 text-base text-bili-text-primary placeholder-bili-text-tertiary outline-none bg-transparent"
            />
            <button
              type="submit"
              className="px-6 py-3.5 bg-bili-pink text-white text-sm font-medium hover:bg-bili-pink-dark transition-colors"
            >
              搜索
            </button>
          </div>

          {/* Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-bili-border z-20 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSearchQuery(s)
                    handleSearch(s)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-bili-text-primary hover:bg-bili-bg transition-colors text-left"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="text-bili-text-tertiary flex-shrink-0">
                    <path d="M9 17A8 8 0 119 1a8 8 0 010 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* No query - show hot searches and history */}
      {!query && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hot Searches */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-base font-bold text-bili-text-primary mb-4 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1v5M9 14v2M3.5 3.5l3.5 3.5M14.5 3.5L11 7M1 9h5M14 9h3" stroke="#FB7299" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              热搜榜
            </h3>
            <div className="space-y-2">
              {hotSearches.map((item) => (
                <button
                  key={item.rank}
                  onClick={() => handleSearch(item.keyword)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-bili-bg transition-colors text-left"
                >
                  <span
                    className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold ${
                      item.rank <= 3 ? 'bg-bili-pink text-white' : 'bg-bili-bg text-bili-text-tertiary'
                    }`}
                  >
                    {item.rank}
                  </span>
                  <span className="flex-1 text-sm text-bili-text-primary">{item.keyword}</span>
                  <span className="text-xs text-bili-text-tertiary">{formatNumber(item.heat)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search History */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-bili-text-primary">搜索历史</h3>
              <button className="text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors">
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((item) => (
                <button
                  key={item}
                  onClick={() => handleSearch(item)}
                  className="px-3 py-1.5 bg-bili-bg text-bili-text-secondary text-sm rounded-full hover:bg-bili-pink-light hover:text-bili-pink transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {query && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 shadow-sm">
              {[
                { key: 'all' as const, label: '综合' },
                { key: 'video' as const, label: '视频' },
                { key: 'user' as const, label: '用户' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    filterType === f.key ? 'bg-bili-pink text-white' : 'text-bili-text-secondary hover:text-bili-text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {showVideos && (
              <>
                <div className="flex items-center gap-1">
                  {[
                    { key: 'relevance' as const, label: '相关度' },
                    { key: 'views' as const, label: '播放量' },
                    { key: 'time' as const, label: '发布时间' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSortBy(s.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        sortBy === s.key ? 'text-bili-pink' : 'text-bili-text-tertiary hover:text-bili-text-primary'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as typeof duration)}
                  className="px-3 py-1.5 border border-bili-border rounded-lg text-xs text-bili-text-secondary bg-white outline-none focus:border-bili-pink"
                >
                  <option value="all">全部时长</option>
                  <option value="short">10分钟以下</option>
                  <option value="medium">10-30分钟</option>
                  <option value="long">30分钟以上</option>
                </select>
              </>
            )}
          </div>

          {/* Result count */}
          <p className="text-sm text-bili-text-tertiary mb-4">
            「{query}」的搜索结果 ({formatNumber(videos.length + users.length)})
          </p>

          {/* Users */}
          {showUsers && users.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-card mb-6">
              <h3 className="text-sm font-semibold text-bili-text-primary mb-3">相关用户</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {users.map((u) => (
                  <UserCard key={u.uid} user={u} showFollowButton />
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {showVideos && (
            <VideoGrid
              videos={videos}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              columns={{ sm: 2, md: 3, lg: 3, xl: 4 }}
            />
          )}
        </>
      )}
    </div>
  )
}
