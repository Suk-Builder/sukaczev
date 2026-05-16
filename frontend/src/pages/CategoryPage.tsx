import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { VideoGrid } from '@/components/Video/VideoGrid'
import type { VideoSimple, Category } from '@/types'
import { formatNumber } from '@/utils/format'

// Mock categories data
const allCategories: Category[] = [
  { id: '1', slug: 'anime', name: '动画', description: '番剧、国创、动画短片', icon: '🎬', parentId: undefined, children: [], sort: 1, videoCount: 156000 },
  { id: '2', slug: 'music', name: '音乐', description: '音乐视频、MV、翻唱', icon: '🎵', parentId: undefined, children: [], sort: 2, videoCount: 234000 },
  { id: '3', slug: 'game', name: '游戏', description: '游戏实况、攻略、评测', icon: '🎮', parentId: undefined, children: [], sort: 3, videoCount: 189000 },
  { id: '4', slug: 'tech', name: '科技', description: '数码评测、编程教程', icon: '💻', parentId: undefined, children: [], sort: 4, videoCount: 98000 },
  { id: '5', slug: 'knowledge', name: '知识', description: '科普、历史、语言学习', icon: '📚', parentId: undefined, children: [], sort: 5, videoCount: 87000 },
  { id: '6', slug: 'life', name: '生活', description: '日常、Vlog、手工', icon: '🏠', parentId: undefined, children: [], sort: 6, videoCount: 312000 },
  { id: '7', slug: 'food', name: '美食', description: '美食制作、探店', icon: '🍜', parentId: undefined, children: [], sort: 7, videoCount: 145000 },
  { id: '8', slug: 'dance', name: '舞蹈', description: '宅舞、街舞、舞蹈教学', icon: '💃', parentId: undefined, children: [], sort: 8, videoCount: 67000 },
  { id: '9', slug: 'movie', name: '影视', description: '电影解说、影评、剪辑', icon: '🎥', parentId: undefined, children: [], sort: 9, videoCount: 112000 },
  { id: '10', slug: 'fashion', name: '时尚', description: '穿搭、美妆、护肤', icon: '👗', parentId: undefined, children: [], sort: 10, videoCount: 54000 },
  { id: '11', slug: 'sports', name: '运动', description: '健身、球类、极限运动', icon: '⚽', parentId: undefined, children: [], sort: 11, videoCount: 78000 },
  { id: '12', slug: 'pet', name: '动物', description: '萌宠、动物世界', icon: '🐱', parentId: undefined, children: [], sort: 12, videoCount: 89000 },
]

// Sub-categories
const subCategories: Record<string, { id: string; name: string }[]> = {
  anime: [
    { id: 'all', name: '全部' },
    { id: 'bangumi', name: '番剧' },
    { id: 'guochuang', name: '国创' },
    { id: 'short', name: '短片' },
    { id: 'amv', name: 'AMV' },
    { id: 'mad', name: 'MAD' },
  ],
  music: [
    { id: 'all', name: '全部' },
    { id: 'mv', name: 'MV' },
    { id: 'cover', name: '翻唱' },
    { id: 'original', name: '原创' },
    { id: 'live', name: '现场' },
    { id: 'instrument', name: '演奏' },
  ],
  game: [
    { id: 'all', name: '全部' },
    { id: 'rpg', name: '角色扮演' },
    { id: 'fps', name: '射击' },
    { id: 'moba', name: 'MOBA' },
    { id: 'strategy', name: '策略' },
    { id: 'casual', name: '休闲' },
  ],
  tech: [
    { id: 'all', name: '全部' },
    { id: 'review', name: '评测' },
    { id: 'coding', name: '编程' },
    { id: 'ai', name: 'AI' },
    { id: 'phone', name: '手机' },
    { id: 'pc', name: '电脑' },
  ],
  knowledge: [
    { id: 'all', name: '全部' },
    { id: 'science', name: '科学' },
    { id: 'history', name: '历史' },
    { id: 'language', name: '语言' },
    { id: 'psychology', name: '心理' },
    { id: 'economy', name: '经济' },
  ],
  life: [
    { id: 'all', name: '全部' },
    { id: 'vlog', name: 'Vlog' },
    { id: 'diy', name: '手工' },
    { id: 'travel', name: '旅行' },
    { id: 'home', name: '家居' },
    { id: 'parenting', name: '育儿' },
  ],
  food: [
    { id: 'all', name: '全部' },
    { id: 'cooking', name: '烹饪' },
    { id: 'explore', name: '探店' },
    { id: 'baking', name: '烘焙' },
    { id: 'drink', name: '饮品' },
  ],
  dance: [
    { id: 'all', name: '全部' },
    { id: 'otaku', name: '宅舞' },
    { id: 'street', name: '街舞' },
    { id: 'ballet', name: '芭蕾' },
    { id: 'tutorial', name: '教学' },
  ],
  movie: [
    { id: 'all', name: '全部' },
    { id: 'review', name: '影评' },
    { id: 'edit', name: '剪辑' },
    { id: 'recommend', name: '推荐' },
    { id: 'classic', name: '经典' },
  ],
  fashion: [
    { id: 'all', name: '全部' },
    { id: 'clothing', name: '穿搭' },
    { id: 'makeup', name: '美妆' },
    { id: 'skincare', name: '护肤' },
  ],
  sports: [
    { id: 'all', name: '全部' },
    { id: 'fitness', name: '健身' },
    { id: 'basketball', name: '篮球' },
    { id: 'soccer', name: '足球' },
    { id: 'extreme', name: '极限' },
  ],
  pet: [
    { id: 'all', name: '全部' },
    { id: 'cat', name: '猫咪' },
    { id: 'dog', name: '狗狗' },
    { id: 'other', name: '其他' },
    { id: 'wild', name: '野生动物' },
  ],
}

function generateCategoryVideos(count: number, seed: string): VideoSimple[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `cat-${seed}-${i}`,
    bvid: `BV1cat${i.toString().padStart(8, '0')}`,
    title: [
      '【4K超清】绝美风景纪录片，每一帧都是壁纸',
      '全网最详细教程！手把手教你从零开始',
      '这个视频会让你笑到停不下来',
      '震撼！这是我见过最厉害的表演',
      '沉浸式体验，戴上耳机效果更佳',
    ][i % 5],
    cover: `https://picsum.photos/seed/cat${seed}${i}/640/360`,
    duration: 120 + Math.floor(Math.random() * 600),
    durationFormatted: '',
    author: {
      uid: `user-${i % 20}`,
      nickname: ['小明', '张三', '美食达人', '科技前沿', '音乐博主'][i % 5],
      avatar: `https://picsum.photos/seed/catavatar${i}/100/100`,
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

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [category, setCategory] = useState<Category | null>(null)
  const [videos, setVideos] = useState<VideoSimple[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [activeSubCategory, setActiveSubCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'hot' | 'new'>('hot')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!slug) return
    const cat = allCategories.find((c) => c.slug === slug)
    if (!cat) return

    setCategory(cat)
    setLoading(true)
    setPage(1)
    setHasMore(true)
    setActiveSubCategory('all')

    setTimeout(() => {
      setVideos(generateCategoryVideos(20, slug))
      setLoading(false)
    }, 500)
  }, [slug])

  const loadMore = useCallback(() => {
    if (!slug || loading || !hasMore) return
    setLoading(true)
    setTimeout(() => {
      const newVideos = generateCategoryVideos(10, `${slug}-${page}`)
      setVideos((prev) => [...prev, ...newVideos])
      setPage((prev) => prev + 1)
      setLoading(false)
      if (page >= 5) setHasMore(false)
    }, 800)
  }, [slug, loading, hasMore, page])

  const handleSortChange = useCallback(
    (sort: 'hot' | 'new') => {
      if (sort === sortBy) return
      setSortBy(sort)
      setPage(1)
      setHasMore(true)
      setLoading(true)
      setTimeout(() => {
        setVideos(generateCategoryVideos(20, `${slug}-${sort}`))
        setLoading(false)
      }, 500)
    },
    [sortBy, slug]
  )

  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-bili-text-tertiary">分类不存在</p>
      </div>
    )
  }

  const subs = subCategories[slug || ''] || [{ id: 'all', name: '全部' }]

  return (
    <div className="min-h-screen">
      {/* Category Header */}
      <div className="bg-white rounded-xl p-6 shadow-card mb-6">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{category.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-bili-text-primary">{category.name}</h1>
            <p className="text-sm text-bili-text-tertiary mt-0.5">
              {category.description} · {formatNumber(category.videoCount)} 个视频
            </p>
          </div>
        </div>
      </div>

      {/* Sub Categories */}
      {subs.length > 1 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
          {subs.map((sub) => (
            <button
              key={sub.id}
              onClick={() => {
                setActiveSubCategory(sub.id)
                setPage(1)
                setVideos(generateCategoryVideos(20, `${slug}-${sub.id}`))
              }}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeSubCategory === sub.id
                  ? 'bg-bili-pink text-white'
                  : 'bg-white text-bili-text-secondary hover:bg-bili-bg'
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Sort & Filter */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 shadow-sm">
          <button
            onClick={() => handleSortChange('hot')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              sortBy === 'hot' ? 'bg-bili-pink text-white shadow-sm' : 'text-bili-text-secondary hover:text-bili-text-primary'
            }`}
          >
            最热
          </button>
          <button
            onClick={() => handleSortChange('new')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              sortBy === 'new' ? 'bg-bili-pink text-white shadow-sm' : 'text-bili-text-secondary hover:text-bili-text-primary'
            }`}
          >
            最新
          </button>
        </div>
        <span className="text-xs text-bili-text-tertiary">共 {formatNumber(category.videoCount)} 个视频</span>
      </div>

      {/* Video Grid */}
      <VideoGrid
        videos={videos}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        columns={{ sm: 2, md: 3, lg: 3, xl: 4 }}
      />
    </div>
  )
}
