import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { VideoPlayer } from '@/components/Video/VideoPlayer'
import { DanmakuLayer } from '@/components/Video/DanmakuLayer'
import { DanmakuInput } from '@/components/Video/DanmakuInput'
import { CommentList } from '@/components/Comment/CommentList'
import { VideoCardCompact } from '@/components/Video/VideoCard'
import { FollowButton } from '@/components/User/FollowButton'
import { useAuthStore } from '@/stores/authStore'
import { useDanmaku } from '@/hooks/useDanmaku'
import type { VideoSimple, Danmaku as DanmakuType, Video, UserSimple } from '@/types'
import { formatNumber, formatDuration } from '@/utils/format'

// Generate mock related videos
function generateRelatedVideos(count: number): VideoSimple[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `rel-${i}`,
    bvid: `BV1rel${i.toString().padStart(8, '0')}`,
    title: [
      '【4K超清】绝美风景纪录片，每一帧都是壁纸',
      '全网最详细教程！手把手教你从零开始',
      '这个视频会让你笑到停不下来',
      '震撼！这是我见过最厉害的表演',
      '沉浸式体验，戴上耳机效果更佳',
      '【合集】经典名场面盘点，你看过几个？',
      '实测！网上流传的方法真的有效吗？',
      '高能预警！这一段太精彩了',
    ][i % 8],
    cover: `https://picsum.photos/seed/rel${i}/640/360`,
    duration: 120 + Math.floor(Math.random() * 600),
    durationFormatted: '',
    author: {
      uid: `user-${i % 10}`,
      nickname: ['小明', '张三', '美食达人', '科技前沿', '音乐博主'][i % 5],
      avatar: `https://picsum.photos/seed/relavatar${i}/100/100`,
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

// Mock danmaku data
function generateMockDanmaku(videoId: string): DanmakuType[] {
  const contents = [
    '太厉害了！', '666666', '来了来了', '前排', '第一！',
    '哈哈哈', '太强了', '卧槽', '牛逼', '厉害了我的哥',
    '这也太帅了吧', '好家伙', '学到了', '收藏了', '已投币',
    '这就是大佬吗', '太强了', '膜拜', '哈哈哈哈', '笑死我了',
    '这也太美了', '爱了爱了', '好听', '再来一遍', '经典',
    '名场面', '高能预警', '弹幕护体', '许愿成功', '火钳刘明',
  ]
  
  return Array.from({ length: 200 }).map((_, i) => ({
    id: `dm-${videoId}-${i}`,
    videoId,
    userId: `user-${i % 50}`,
    user: {
      uid: `user-${i % 50}`,
      nickname: `用户${i % 50}`,
      avatar: '',
      level: (i % 6) + 1,
      isVip: i % 5 === 0,
      signature: '',
    },
    content: contents[i % contents.length],
    time: Math.random() * 300,
    color: ['#FFFFFF', '#FB7299', '#00A1D6', '#FF6B6B', '#FFD93D', '#6BCB77', '#C084FC'][i % 7],
    type: (['scroll', 'scroll', 'scroll', 'top', 'bottom'][i % 5]) as 'scroll' | 'top' | 'bottom',
    fontSize: [18, 20, 24][i % 3],
    createdAt: new Date().toISOString(),
  }))
}

// Mock video data
function generateMockVideo(id: string): Video {
  const mockAuthor: UserSimple = {
    uid: 'author-1',
    nickname: '创作者小王',
    avatar: 'https://picsum.photos/seed/author1/200/200',
    level: 5,
    isVip: true,
    signature: '热爱创作，分享生活',
  }

  return {
    id,
    bvid: id,
    title: '【4K超清】2024年度最强混剪 —— 每一帧都是壁纸级别的视觉盛宴',
    description: `这是一个超高质量的视频混剪作品，收录了2024年最精彩的瞬间。
    
制作不易，希望大家喜欢！如果觉得不错的话记得一键三连哦~

BGM：Various Artists
素材来源：网络
制作工具：Premiere Pro / After Effects

#混剪 #4K #视觉盛宴 #年度盘点`,
    cover: 'https://picsum.photos/seed/videohero/1920/1080',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 320,
    durationFormatted: '05:20',
    category: { id: '1', slug: 'movie', name: '影视', description: '', icon: '🎬', children: [], sort: 1, videoCount: 1000 },
    tags: [
      { id: '1', name: '混剪', slug: 'mix', count: 10000 },
      { id: '2', name: '4K', slug: '4k', count: 5000 },
      { id: '3', name: '视觉盛宴', slug: 'visual', count: 3000 },
    ],
    author: mockAuthor,
    stats: {
      views: 1258000,
      likes: 85600,
      coins: 42300,
      favorites: 67800,
      shares: 12500,
      replies: 8900,
      danmakuCount: 156000,
    },
    status: 'public',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    quality: [
      { quality: 120, label: '4K', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
      { quality: 80, label: '1080P', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
      { quality: 64, label: '720P', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
      { quality: 32, label: '480P', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
    ],
  }
}

export function VideoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [relatedVideos, setRelatedVideos] = useState<VideoSimple[]>([])
  const [playerTime, setPlayerTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [liked, setLiked] = useState(false)
  const [coined, setCoined] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [showCoinDialog, setShowCoinDialog] = useState(false)
  const [danmakuData, setDanmakuData] = useState<DanmakuType[]>([])
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const playerContainerRef = useRef<HTMLDivElement>(null)

  // Load video data
  useEffect(() => {
    if (!id) return
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setVideo(generateMockVideo(id))
      setRelatedVideos(generateRelatedVideos(15))
      setDanmakuData(generateMockDanmaku(id))
      setLoading(false)
    }, 600)
  }, [id])

  // Measure container
  useEffect(() => {
    const el = playerContainerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Danmaku hook
  const { sendDanmaku } = useDanmaku({ videoId: id || '' })

  // Handle time update from player
  const handleTimeUpdate = useCallback((time: number) => {
    setPlayerTime(time)
  }, [])

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing)
  }, [])

  // Handle danmaku send
  const handleSendDanmaku = useCallback(
    async (content: string, color: string, type: 'scroll' | 'top' | 'bottom', fontSize: number) => {
      await sendDanmaku({ content, time: playerTime, color, type, fontSize })
    },
    [sendDanmaku, playerTime]
  )

  // Actions
  const handleLike = () => {
    setLiked(!liked)
    if (!liked) {
      setVideo((prev) => prev ? { ...prev, stats: { ...prev.stats, likes: prev.stats.likes + 1 } } : null)
    }
  }

  const handleCoin = (count: number) => {
    setCoined(true)
    setShowCoinDialog(false)
    setVideo((prev) => prev ? { ...prev, stats: { ...prev.stats, coins: prev.stats.coins + count } } : null)
  }

  const handleFavorite = () => {
    setFavorited(!favorited)
    if (!favorited) {
      setVideo((prev) => prev ? { ...prev, stats: { ...prev.stats, favorites: prev.stats.favorites + 1 } } : null)
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-bili-border border-t-bili-pink rounded-full animate-spin" />
      </div>
    )
  }

  if (!video || !id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-bili-text-tertiary">视频不存在</p>
        <button onClick={() => navigate('/')} className="mt-4 text-bili-pink hover:underline">
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Video Player Section */}
        <div ref={playerContainerRef} className="relative">
          <VideoPlayer
            videoId={id}
            src={video.url}
            poster={video.cover}
            title={video.title}
          />
          {/* Danmaku Layer */}
          <DanmakuLayer
            danmakuList={danmakuData}
            currentTime={playerTime}
            settings={{ opacity: 1, speed: 1, fontSize: 1, density: 'medium', blockTypes: [], show: true }}
            isPlaying={isPlaying}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        </div>

        {/* Danmaku Input */}
        <div className="mt-3">
          <DanmakuInput onSend={handleSendDanmaku} />
        </div>

        {/* Video Info */}
        <div className="mt-4 bg-white rounded-xl p-5 shadow-card">
          <h1 className="text-lg md:text-xl font-bold text-bili-text-primary leading-snug">{video.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-bili-text-tertiary">
            <span>{formatNumber(video.stats.views)}次观看</span>
            <span>·</span>
            <span>{formatNumber(video.stats.danmakuCount)}弹幕</span>
            <span>·</span>
            <span>{new Date(video.publishedAt).toLocaleDateString('zh-CN')}</span>
            <span>·</span>
            <span>BV号：{video.bvid}</span>
          </div>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-2">
            {video.tags.map((tag) => (
              <Link
                key={tag.id}
                to={`/search?q=${encodeURIComponent(tag.name)}`}
                className="px-3 py-1 bg-bili-bg text-bili-text-secondary text-xs rounded-full hover:bg-bili-pink-light hover:text-bili-pink transition-colors"
              >
                {tag.name}
              </Link>
            ))}
          </div>

          {/* Description */}
          <p className="mt-3 text-sm text-bili-text-secondary whitespace-pre-wrap">{video.description}</p>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              liked
                ? 'bg-bili-pink text-white'
                : 'bg-white text-bili-text-primary border border-bili-border hover:border-bili-pink hover:text-bili-pink'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 15.5S2 10.5 2 6a3.5 3.5 0 017 0 3.5 3.5 0 017 0c0 4.5-7 9.5-7 9.5z"
                fill={liked ? 'white' : 'none'}
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
            {liked ? '已赞' : '点赞'} {formatNumber(video.stats.likes + (liked ? 1 : 0))}
          </button>

          <button
            onClick={() => setShowCoinDialog(!showCoinDialog)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
              coined
                ? 'bg-yellow-50 text-yellow-600 border border-yellow-200'
                : 'bg-white text-bili-text-primary border border-bili-border hover:border-yellow-400 hover:text-yellow-600'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6 7.5h.75c.5 0 .75.25.75.75v2.25c0 .5.25.75.75.75h1.5M9 6v5.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            投币 {formatNumber(video.stats.coins)}

            {/* Coin Selector */}
            {showCoinDialog && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-bili-border p-3 z-20 animate-slide-down">
                <p className="text-xs text-bili-text-tertiary mb-2">选择投币数量</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCoin(1)}
                    className="px-4 py-2 bg-bili-bg rounded-lg text-sm hover:bg-bili-pink hover:text-white transition-colors"
                  >
                    1 枚
                  </button>
                  <button
                    onClick={() => handleCoin(2)}
                    className="px-4 py-2 bg-bili-bg rounded-lg text-sm hover:bg-bili-pink hover:text-white transition-colors"
                  >
                    2 枚
                  </button>
                </div>
              </div>
            )}
          </button>

          <button
            onClick={handleFavorite}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              favorited
                ? 'bg-yellow-50 text-yellow-600 border border-yellow-200'
                : 'bg-white text-bili-text-primary border border-bili-border hover:border-yellow-400 hover:text-yellow-600'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2l2 4.5 5 .5-3.5 3.5 1 5-4.5-2.5L4.5 15.5l1-5L2 7l5-.5L9 2z"
                fill={favorited ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            收藏 {formatNumber(video.stats.favorites)}
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-bili-text-primary border border-bili-border rounded-lg text-sm font-medium hover:border-bili-pink hover:text-bili-pink transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="13" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="13" cy="13" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M7 8l4.5-2.5M7.5 10.5l4 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            分享 {formatNumber(video.stats.shares)}
          </button>
        </div>

        {/* Author Info */}
        <div className="mt-4 bg-white rounded-xl p-5 shadow-card flex items-center gap-4">
          <Link to={`/space/${video.author.uid}`}>
            <img
              src={video.author.avatar}
              alt={video.author.nickname}
              className="w-12 h-12 rounded-full object-cover"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              to={`/space/${video.author.uid}`}
              className="text-base font-semibold text-bili-text-primary hover:text-bili-pink transition-colors"
            >
              {video.author.nickname}
            </Link>
            <p className="text-xs text-bili-text-tertiary truncate">{video.author.signature || '暂无签名'}</p>
          </div>
          <FollowButton uid={video.author.uid} />
        </div>

        {/* Comments */}
        <div className="mt-4">
          <CommentList videoId={id} />
        </div>
      </div>

      {/* Right Sidebar - Related Videos */}
      <aside className="w-full xl:w-80 flex-shrink-0">
        <div className="bg-white rounded-xl p-5 shadow-card sticky top-20">
          <h3 className="text-base font-bold text-bili-text-primary mb-4">相关推荐</h3>
          <div className="space-y-3">
            {relatedVideos.map((v) => (
              <VideoCardCompact key={v.id} video={v} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
