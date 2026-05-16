import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { VideoGrid } from '@/components/Video/VideoGrid'
import { VideoHorizontalList } from '@/components/Video/VideoGrid'
import { VideoCardCompact } from '@/components/Video/VideoCard'
import type { VideoSimple, Banner } from '@/types'

// Mock data for development
const mockBanners: Banner[] = [
  { id: '1', title: '2024年度最强混剪', subtitle: '燃爆全场', image: 'https://picsum.photos/seed/banner1/1200/400', link: '/video/BV1xx411c7mD', color: '#FB7299', sort: 1 },
  { id: '2', title: '新番导视', subtitle: '一月新番推荐', image: 'https://picsum.photos/seed/banner2/1200/400', link: '/category/anime', color: '#00A1D6', sort: 2 },
  { id: '3', title: '音乐盛典', subtitle: '年度金曲回顾', image: 'https://picsum.photos/seed/banner3/1200/400', link: '/category/music', color: '#FF6B6B', sort: 3 },
  { id: '4', title: '科技前沿', subtitle: 'AI技术新进展', image: 'https://picsum.photos/seed/banner4/1200/400', link: '/category/tech', color: '#6BCB77', sort: 4 },
]

function generateMockVideos(count: number, seed: string): VideoSimple[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${seed}-${i}`,
    bvid: `BV1${seed}${i.toString().padStart(8, '0')}`,
    title: [
      '【4K超清】绝美风景纪录片，每一帧都是壁纸',
      '全网最详细教程！手把手教你从零开始',
      '这个视频会让你笑到停不下来',
      '震撼！这是我见过最厉害的表演',
      '沉浸式体验，戴上耳机效果更佳',
      '【合集】经典名场面盘点，你看过几个？',
      '实测！网上流传的方法真的有效吗？',
      '高能预警！这一段太精彩了',
      '治愈系美食，看完心情都变好了',
      '前方核能！百万级特效混剪',
    ][i % 10],
    cover: `https://picsum.photos/seed/${seed}${i}/640/360`,
    duration: 120 + Math.floor(Math.random() * 600),
    durationFormatted: '',
    author: {
      uid: `user-${i % 20}`,
      nickname: ['小明', '张三', '美食达人', '科技前沿', '音乐博主', '游戏主播', '知识分享', '生活记录'][i % 8],
      avatar: `https://picsum.photos/seed/avatar${i}/100/100`,
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
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  }))
}

const categories = [
  { id: 'recommend', name: '推荐' },
  { id: 'anime', name: '动画' },
  { id: 'music', name: '音乐' },
  { id: 'tech', name: '科技' },
  { id: 'knowledge', name: '知识' },
  { id: 'life', name: '生活' },
  { id: 'game', name: '游戏' },
  { id: 'dance', name: '舞蹈' },
  { id: 'food', name: '美食' },
  { id: 'movie', name: '影视' },
  { id: 'fashion', name: '时尚' },
  { id: 'sports', name: '运动' },
]

export function Home() {
  const [activeCategory, setActiveCategory] = useState('recommend')
  const [videos, setVideos] = useState<VideoSimple[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [currentBanner, setCurrentBanner] = useState(0)
  const [hotVideos, setHotVideos] = useState<VideoSimple[]>([])
  const [rankingVideos, setRankingVideos] = useState<VideoSimple[]>([])

  // Load initial data
  useEffect(() => {
    setVideos(generateMockVideos(20, activeCategory))
    setHotVideos(generateMockVideos(8, 'hot'))
    setRankingVideos(generateMockVideos(10, 'rank'))
    setLoading(false)
  }, [])

  // Category change
  const handleCategoryChange = useCallback((catId: string) => {
    setActiveCategory(catId)
    setLoading(true)
    setPage(1)
    setHasMore(true)
    // Simulate API call
    setTimeout(() => {
      setVideos(generateMockVideos(20, catId))
      setLoading(false)
    }, 500)
  }, [])

  // Load more
  const handleLoadMore = useCallback(() => {
    if (loading || !hasMore) return
    setLoading(true)
    setTimeout(() => {
      const newVideos = generateMockVideos(10, `${activeCategory}-${page}`)
      setVideos((prev) => [...prev, ...newVideos])
      setPage((prev) => prev + 1)
      setLoading(false)
      if (page >= 5) setHasMore(false)
    }, 800)
  }, [loading, hasMore, activeCategory, page])

  // Banner auto-rotate
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % mockBanners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen">
      {/* Hero Banner Section */}
      <section className="relative mb-6 rounded-2xl overflow-hidden bg-gradient-to-r from-bili-header to-bili-header/90">
        <div className="relative h-48 md:h-64 lg:h-80">
          {mockBanners.map((banner, index) => (
            <Link
              key={banner.id}
              to={banner.link}
              className={`absolute inset-0 transition-opacity duration-700 ${
                index === currentBanner ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <div
                  className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-md mb-2"
                  style={{ backgroundColor: banner.color, color: 'white' }}
                >
                  {banner.subtitle}
                </div>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">{banner.title}</h2>
              </div>
            </Link>
          ))}

          {/* Banner Dots */}
          <div className="absolute bottom-4 right-6 flex items-center gap-2">
            {mockBanners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentBanner(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentBanner ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>

          {/* Banner Arrows */}
          <button
            onClick={() => setCurrentBanner((prev) => (prev - 1 + mockBanners.length) % mockBanners.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentBanner((prev) => (prev + 1) % mockBanners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </section>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Category Tabs */}
          <div className="sticky top-16 z-30 -mx-2 px-2 py-3 bg-bili-bg mb-4">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    activeCategory === cat.id
                      ? 'bg-bili-pink text-white shadow-sm'
                      : 'text-bili-text-secondary hover:bg-white hover:text-bili-text-primary'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Video Grid */}
          <VideoGrid
            videos={videos}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            columns={{ sm: 2, md: 3, lg: 3, xl: 4 }}
          />
        </div>

        {/* Right Sidebar */}
        <aside className="w-full xl:w-80 flex-shrink-0 space-y-6">
          {/* Hot Videos */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-bili-text-primary flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 1l2 5.5h5.5L11.5 10l1.5 6L9 12.5 5 16l1.5-6L1.5 6.5H7L9 1z" stroke="#FB7299" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                热门视频
              </h3>
              <Link to="/popular" className="text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors">
                更多
              </Link>
            </div>
            <div className="space-y-3">
              {hotVideos.slice(0, 5).map((video, index) => (
                <div key={video.id} className="flex items-center gap-3 group cursor-pointer">
                  <span
                    className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs font-bold ${
                      index < 3 ? 'bg-bili-pink text-white' : 'bg-bili-bg text-bili-text-tertiary'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <Link to={`/video/${video.bvid}`} className="flex-1 min-w-0">
                    <p className="text-sm text-bili-text-primary line-clamp-1 group-hover:text-bili-pink transition-colors">
                      {video.title}
                    </p>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Ranking */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-bili-text-primary flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 14V7h3v7H3zm4.5 0V3h3v11h-3zm4.5 0v-4h3v4h-3z" fill="#FB7299" opacity="0.8" />
                </svg>
                排行榜
              </h3>
              <Link to="/ranking" className="text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors">
                完整榜单
              </Link>
            </div>
            <div className="space-y-3">
              {rankingVideos.slice(0, 8).map((video, index) => (
                <VideoCardCompact key={video.id} video={video} />
              ))}
            </div>
          </div>

          {/* Announcement */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-base font-bold text-bili-text-primary mb-3">公告</h3>
            <div className="space-y-2.5">
              {[
                { title: 'Sukačev 新版上线啦！', date: '2024-01-15' },
                { title: '创作者激励计划开启', date: '2024-01-10' },
                { title: '关于弹幕功能升级通知', date: '2024-01-08' },
                { title: '社区规范更新说明', date: '2024-01-05' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 group cursor-pointer">
                  <span className="w-1.5 h-1.5 rounded-full bg-bili-pink mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bili-text-primary line-clamp-1 group-hover:text-bili-pink transition-colors">
                      {item.title}
                    </p>
                    <span className="text-[10px] text-bili-text-tertiary">{item.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-base font-bold text-bili-text-primary mb-3">热门标签</h3>
            <div className="flex flex-wrap gap-2">
              {['原神', '鬼畜', '美食教程', 'AI', '音乐', '舞蹈', '科技', '动漫', '游戏', '搞笑'].map((tag) => (
                <Link
                  key={tag}
                  to={`/search?q=${encodeURIComponent(tag)}`}
                  className="px-3 py-1.5 bg-bili-bg text-bili-text-secondary text-xs rounded-full hover:bg-bili-pink-light hover:text-bili-pink transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
