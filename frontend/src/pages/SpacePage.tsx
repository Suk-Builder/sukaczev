import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { VideoGrid } from '@/components/Video/VideoGrid'
import { VideoCardCompact } from '@/components/Video/VideoCard'
import { FollowButton, FollowStats } from '@/components/User/FollowButton'
import { UserCard } from '@/components/User/UserCard'
import type { User, VideoSimple, FavoriteFolder } from '@/types'
import { formatNumber, getLevelColor, getLevelBgColor } from '@/utils/format'

// Mock user data
function generateMockUser(uid: string): User {
  return {
    id: uid,
    uid,
    username: `user_${uid}`,
    nickname: '创作者小王',
    avatar: 'https://picsum.photos/seed/spaceuser/400/400',
    email: 'user@example.com',
    signature: '热爱生活，分享创作。不定期更新视频，感谢关注！',
    level: 5,
    exp: 12450,
    coins: 2300,
    following: 128,
    followers: 56800,
    likes: 234000,
    isVip: true,
    vipType: 'year',
    createTime: '2020-03-15T00:00:00Z',
    birthday: '1998-06-15',
    gender: 'male',
  }
}

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
    ][i % 5],
    cover: `https://picsum.photos/seed/${seed}${i}/640/360`,
    duration: 120 + Math.floor(Math.random() * 600),
    durationFormatted: '',
    author: {
      uid: 'author-1',
      nickname: '创作者小王',
      avatar: 'https://picsum.photos/seed/spaceuser/400/400',
      level: 5,
      isVip: true,
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
    createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
  }))
}

const mockFolders: FavoriteFolder[] = [
  { id: '1', userId: 'user-1', name: '默认收藏夹', description: '自动创建的收藏夹', isDefault: true, isPublic: true, videoCount: 156, cover: 'https://picsum.photos/seed/fav1/640/360', createdAt: '2020-03-15', updatedAt: '2024-01-15' },
  { id: '2', userId: 'user-1', name: '学习资料', description: '技术教程和学习资源', isDefault: false, isPublic: true, videoCount: 89, cover: 'https://picsum.photos/seed/fav2/640/360', createdAt: '2021-01-20', updatedAt: '2024-01-10' },
  { id: '3', userId: 'user-1', name: '音乐收藏', description: '好听的歌曲和音乐视频', isDefault: false, isPublic: true, videoCount: 234, cover: 'https://picsum.photos/seed/fav3/640/360', createdAt: '2021-06-10', updatedAt: '2024-01-12' },
  { id: '4', userId: 'user-1', name: '美食教程', description: '想学做菜就看这些', isDefault: false, isPublic: false, videoCount: 45, cover: 'https://picsum.photos/seed/fav4/640/360', createdAt: '2022-02-28', updatedAt: '2024-01-08' },
]

const tabs = [
  { id: 'videos', label: '投稿', icon: '🎬' },
  { id: 'favorites', label: '收藏', icon: '⭐' },
  { id: 'dynamic', label: '动态', icon: '📝' },
]

export function SpacePage() {
  const { uid } = useParams<{ uid: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('videos')
  const [videos, setVideos] = useState<VideoSimple[]>([])
  const [loading, setLoading] = useState(true)
  const [dynamicPosts, setDynamicPosts] = useState<{ id: string; content: string; video?: VideoSimple; createdAt: string; likes: number; replies: number }[]>([])

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    setTimeout(() => {
      setUser(generateMockUser(uid))
      setVideos(generateMockVideos(16, 'space'))
      setDynamicPosts([
        {
          id: '1',
          content: '新视频发布啦！这次花了好长时间制作，希望大家喜欢~',
          video: generateMockVideos(1, 'dynamic1')[0],
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          likes: 1200,
          replies: 345,
        },
        {
          id: '2',
          content: '感谢大家一直以来的支持！十万粉丝达成，准备做一期QA视频，大家有什么问题可以在评论区留言~',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          likes: 2300,
          replies: 567,
        },
        {
          id: '3',
          content: '最近在尝试新的视频风格，大家感觉怎么样？',
          video: generateMockVideos(1, 'dynamic3')[0],
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          likes: 890,
          replies: 234,
        },
      ])
      setLoading(false)
    }, 500)
  }, [uid])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-bili-border border-t-bili-pink rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-bili-text-tertiary">用户不存在</p>
      </div>
    )
  }

  const levelColor = getLevelColor(user.level)
  const levelBgColor = getLevelBgColor(user.level)

  return (
    <div className="min-h-screen">
      {/* Cover Banner */}
      <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden mb-8 bg-gradient-to-r from-bili-pink/30 via-purple-200/50 to-bili-blue/30">
        <img
          src={`https://picsum.photos/seed/cover${uid}/1200/400`}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      {/* User Info Card */}
      <div className="relative -mt-20 mb-6 px-4 md:px-8">
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <img
              src={user.avatar}
              alt={user.nickname}
              className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-bili-text-primary">{user.nickname}</h1>
                <span
                  className="px-2 py-0.5 text-xs font-bold rounded"
                  style={{ color: levelColor, backgroundColor: levelBgColor }}
                >
                  Lv{user.level}
                </span>
                {user.isVip && (
                  <span className="px-2 py-0.5 bg-bili-pink text-white text-[10px] font-bold rounded leading-none">
                    {user.vipType === 'year' ? '年度大会员' : '月度大会员'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-bili-text-tertiary">{user.signature}</p>
              <div className="mt-2 flex items-center gap-4 text-xs text-bili-text-tertiary">
                <span>UID：{user.uid}</span>
                <span>注册于 {new Date(user.createTime).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
            <FollowButton uid={user.uid} size="lg" />
          </div>

          {/* Stats */}
          <div className="mt-4 pt-4 border-t border-bili-border-light">
            <FollowStats following={user.following} followers={user.followers} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 bg-white rounded-xl p-1.5 shadow-card">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-bili-pink text-white shadow-sm'
                : 'text-bili-text-secondary hover:bg-bili-bg hover:text-bili-text-primary'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'videos' && (
        <VideoGrid
          videos={videos}
          loading={false}
          hasMore={false}
          columns={{ sm: 2, md: 3, lg: 3, xl: 4 }}
        />
      )}

      {activeTab === 'favorites' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockFolders.map((folder) => (
            <div key={folder.id} className="bg-white rounded-xl p-4 shadow-card hover:shadow-card-hover transition-shadow group cursor-pointer">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-bili-bg">
                  <img
                    src={folder.cover}
                    alt={folder.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="flex-1 min-w-0 py-1">
                  <h3 className="text-base font-semibold text-bili-text-primary group-hover:text-bili-pink transition-colors">
                    {folder.name}
                  </h3>
                  <p className="mt-1 text-xs text-bili-text-tertiary line-clamp-1">{folder.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-bili-text-tertiary">
                    <span>{folder.videoCount} 个视频</span>
                    <span>{folder.isPublic ? '公开' : '私密'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'dynamic' && (
        <div className="space-y-4">
          {dynamicPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl p-5 shadow-card">
              <div className="flex items-start gap-3">
                <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-bili-text-primary">{user.nickname}</span>
                    <span className="text-xs text-bili-text-tertiary">{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <p className="mt-2 text-sm text-bili-text-primary whitespace-pre-wrap">{post.content}</p>
                  {post.video && (
                    <div className="mt-3">
                      <VideoCardCompact video={post.video} />
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <button className="flex items-center gap-1 text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 12V5H1v7h2zm8-4.5c0-.3-.1-.5-.3-.7l-.7-.7c-.4-.4-1-.4-1.4 0L8 7.1V4c0-.6-.4-1-1-1s-1 .4-1 1v5.5l-.8-.8c-.4-.4-1-.4-1.4 0l-.6.7c-.2.2-.2.4-.2.7s.1.5.3.7l3.5 3.5c.2.2.4.3.7.3h3c.6 0 1-.4 1-1V7.5z" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                      {formatNumber(post.likes)}
                    </button>
                    <button className="flex items-center gap-1 text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M12 7.5a5.5 5.5 0 10-2 4.25L12 13v-1.5l-.5-.5A5.48 5.48 0 0012 7.5z" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                      {formatNumber(post.replies)}
                    </button>
                    <button className="flex items-center gap-1 text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 5.5l4 3.5 4-3.5M7 1v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      转发
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
