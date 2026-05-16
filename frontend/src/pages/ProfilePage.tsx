import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { VideoGrid } from '@/components/Video/VideoGrid'
import { VideoCardCompact } from '@/components/Video/VideoCard'
import { UserCard } from '@/components/User/UserCard'
import type { VideoSimple, Notification, WatchHistory, FavoriteFolder } from '@/types'
import { formatDateTime } from '@/utils/time'
import { formatNumber } from '@/utils/format'

function generateMockVideos(count: number, seed: string): VideoSimple[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `profile-${seed}-${i}`,
    bvid: `BV1p${seed}${i.toString().padStart(8, '0')}`,
    title: [
      '我的最新投稿视频',
      '一起学习新技术吧',
      '美食制作全过程',
      '旅行Vlog记录',
      '游戏实况精彩时刻',
    ][i % 5],
    cover: `https://picsum.photos/seed/p${seed}${i}/640/360`,
    duration: 120 + Math.floor(Math.random() * 600),
    durationFormatted: '',
    author: {
      uid: 'me',
      nickname: '我',
      avatar: 'https://picsum.photos/seed/me/200/200',
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
    createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
  }))
}

const mockNotifications: Notification[] = [
  { id: '1', userId: 'me', type: 'reply', title: '新回复', content: '用户 小明 回复了你的评论：确实很有道理！', isRead: false, sourceId: 'v1', sourceType: 'video', createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: '2', userId: 'me', type: 'like', title: '新点赞', content: '用户 小红 赞了你的视频', isRead: false, sourceId: 'v1', sourceType: 'video', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: '3', userId: 'me', type: 'follow', title: '新粉丝', content: '用户 科技达人 关注了你', isRead: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: '4', userId: 'me', type: 'system', title: '系统通知', content: '你的视频已通过审核', isRead: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: '5', userId: 'me', type: 'reply', title: '新回复', content: '用户 美食家 回复了你的评论：感谢分享！', isRead: false, sourceId: 'v2', sourceType: 'video', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
]

const mockHistory: WatchHistory[] = [
  { id: '1', video: generateMockVideos(1, 'h1')[0], userId: 'me', progress: 125, duration: 300, watchedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: '2', video: generateMockVideos(1, 'h2')[0], userId: 'me', progress: 280, duration: 300, watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: '3', video: generateMockVideos(1, 'h3')[0], userId: 'me', progress: 45, duration: 600, watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: '4', video: generateMockVideos(1, 'h4')[0], userId: 'me', progress: 0, duration: 450, watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: '5', video: generateMockVideos(1, 'h5')[0], userId: 'me', progress: 600, duration: 600, watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
]

const mockFolders: FavoriteFolder[] = [
  { id: '1', userId: 'me', name: '默认收藏夹', description: '自动创建的收藏夹', isDefault: true, isPublic: true, videoCount: 156, createdAt: '2020-03-15', updatedAt: '2024-01-15' },
  { id: '2', userId: 'me', name: '学习资料', description: '技术教程和学习资源', isDefault: false, isPublic: true, videoCount: 89, createdAt: '2021-01-20', updatedAt: '2024-01-10' },
  { id: '3', userId: 'me', name: '音乐收藏', description: '好听的歌曲和音乐视频', isDefault: false, isPublic: true, videoCount: 234, createdAt: '2021-06-10', updatedAt: '2024-01-12' },
]

const tabs = [
  { id: 'profile', label: '个人信息', icon: '👤' },
  { id: 'videos', label: '我的投稿', icon: '🎬' },
  { id: 'favorites', label: '我的收藏', icon: '⭐' },
  { id: 'history', label: '历史记录', icon: '🕐' },
  { id: 'notifications', label: '消息中心', icon: '🔔' },
]

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)

  const currentTab = searchParams.get('tab') || 'profile'
  const [activeTab, setActiveTab] = useState(currentTab)

  const [editForm, setEditForm] = useState({
    nickname: user?.nickname || '',
    signature: user?.signature || '',
    gender: user?.gender || 'secret' as const,
    birthday: user?.birthday || '',
  })

  const [saving, setSaving] = useState(false)
  const [notifications, setNotifications] = useState(mockNotifications)

  useEffect(() => {
    setActiveTab(currentTab)
  }, [currentTab])

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId })
  }

  const handleSaveProfile = () => {
    setSaving(true)
    setTimeout(() => {
      updateUser({
        nickname: editForm.nickname,
        signature: editForm.signature,
        gender: editForm.gender,
        birthday: editForm.birthday,
      })
      setSaving(false)
    }, 800)
  }

  const handleReadNotification = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
  }

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="min-h-screen">
      {/* Profile Header */}
      <div className="bg-white rounded-xl p-6 shadow-card mb-6">
        <div className="flex items-center gap-4">
          <img
            src={user?.avatar || '/default-avatar.png'}
            alt={user?.nickname}
            className="w-20 h-20 rounded-full object-cover border-4 border-bili-bg"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-bili-text-primary">{user?.nickname || '用户'}</h1>
            <p className="text-sm text-bili-text-tertiary mt-0.5">
              Lv{user?.level || 1} · UID: {user?.uid || '-'}
            </p>
            <p className="text-sm text-bili-text-secondary mt-1">{user?.signature || '暂无签名'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white rounded-xl p-1.5 shadow-card overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-all relative ${
              activeTab === tab.id
                ? 'bg-bili-pink text-white shadow-sm'
                : 'text-bili-text-secondary hover:bg-bili-bg hover:text-bili-text-primary'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.id === 'notifications' && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl p-6 shadow-card">
        {/* Profile Info */}
        {activeTab === 'profile' && (
          <div className="max-w-lg">
            <h3 className="text-lg font-bold text-bili-text-primary mb-5">编辑个人信息</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bili-text-primary mb-1.5">昵称</label>
                <input
                  type="text"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, nickname: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-bili-border rounded-lg text-sm text-bili-text-primary outline-none focus:border-bili-pink focus:ring-2 focus:ring-bili-pink/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-bili-text-primary mb-1.5">个性签名</label>
                <textarea
                  value={editForm.signature}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, signature: e.target.value }))}
                  rows={3}
                  maxLength={200}
                  className="w-full px-4 py-2.5 border border-bili-border rounded-lg text-sm text-bili-text-primary outline-none focus:border-bili-pink focus:ring-2 focus:ring-bili-pink/10 transition-all resize-none"
                />
                <span className="text-xs text-bili-text-tertiary mt-1">{editForm.signature.length}/200</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-bili-text-primary mb-1.5">性别</label>
                <div className="flex items-center gap-4">
                  {[
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' },
                    { value: 'secret', label: '保密' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={option.value}
                        checked={editForm.gender === option.value}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value as typeof prev.gender }))}
                        className="accent-bili-pink"
                      />
                      <span className="text-sm text-bili-text-secondary">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-bili-text-primary mb-1.5">生日</label>
                <input
                  type="date"
                  value={editForm.birthday}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, birthday: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-bili-border rounded-lg text-sm text-bili-text-primary outline-none focus:border-bili-pink focus:ring-2 focus:ring-bili-pink/10 transition-all"
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-6 py-2.5 bg-bili-pink text-white text-sm font-medium rounded-lg hover:bg-bili-pink-dark disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        )}

        {/* My Videos */}
        {activeTab === 'videos' && (
          <VideoGrid
            videos={generateMockVideos(8, 'myvids')}
            loading={false}
            hasMore={false}
            columns={{ sm: 2, md: 3, lg: 3, xl: 4 }}
          />
        )}

        {/* Favorites */}
        {activeTab === 'favorites' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockFolders.map((folder) => (
                <div key={folder.id} className="border border-bili-border rounded-xl p-4 hover:border-bili-pink transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-bili-text-primary group-hover:text-bili-pink transition-colors">
                        {folder.name}
                      </h4>
                      <p className="text-xs text-bili-text-tertiary mt-0.5">{folder.videoCount} 个视频</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${folder.isPublic ? 'bg-green-50 text-green-600' : 'bg-bili-bg text-bili-text-tertiary'}`}>
                      {folder.isPublic ? '公开' : '私密'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-bili-text-primary mb-3">收藏的视频</h4>
              <VideoGrid
                videos={generateMockVideos(8, 'favs')}
                loading={false}
                hasMore={false}
                columns={{ sm: 2, md: 3, lg: 3, xl: 4 }}
              />
            </div>
          </div>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {mockHistory.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-bili-bg transition-colors group">
                <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-bili-bg">
                  <img src={item.video.cover} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                    {Math.floor(item.video.duration / 60)}:{(item.video.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-bili-text-primary line-clamp-1 group-hover:text-bili-pink transition-colors">
                    {item.video.title}
                  </h4>
                  <p className="text-xs text-bili-text-tertiary mt-1">{item.video.author.nickname}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="w-24 h-1 bg-bili-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-bili-pink rounded-full"
                        style={{ width: `${Math.min(100, (item.progress / item.video.duration) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-bili-text-tertiary">
                      {item.progress >= item.duration ? '已看完' : `看到 ${Math.floor(item.progress / 60)}:${(item.progress % 60).toString().padStart(2, '0')}`}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-bili-text-tertiary flex-shrink-0">
                  {new Date(item.watchedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notifications */}
        {activeTab === 'notifications' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-bili-text-primary">
                消息通知 <span className="text-sm text-bili-text-tertiary font-normal">({notifications.length})</span>
              </h3>
              <button
                onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))}
                className="text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors"
              >
                全部已读
              </button>
            </div>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleReadNotification(notification.id)}
                className={`flex items-start gap-3 p-4 rounded-lg transition-colors cursor-pointer ${
                  !notification.isRead ? 'bg-bili-pink-light/50' : 'hover:bg-bili-bg'
                }`}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${getNotificationIconBg(notification.type)}`}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-bili-text-primary">{notification.title}</span>
                    {!notification.isRead && <span className="w-2 h-2 bg-bili-pink rounded-full flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-bili-text-secondary mt-0.5 line-clamp-2">{notification.content}</p>
                  <span className="text-[10px] text-bili-text-tertiary mt-1">{formatDateTime(notification.createdAt)}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteNotification(notification.id)
                  }}
                  className="flex-shrink-0 p-1 text-bili-text-tertiary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'reply':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M14 8c0 3.3-2.7 6-6 6H2l2-2c-.6-.8-1-1.8-1-3 0-3.3 2.7-6 6-6s5 2.7 5 6z" stroke="#00A1D6" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      )
    case 'like':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 14s-5-3.5-5-7a3 3 0 016 0 3 3 0 016 0c0 3.5-5 7-5 7z" stroke="#FB7299" strokeWidth="1.2" />
        </svg>
      )
    case 'follow':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="#6BCB77" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="#9499A0" strokeWidth="1.2" />
          <path d="M8 5v3l2 1.5" stroke="#9499A0" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
  }
}

function getNotificationIconBg(type: string): string {
  switch (type) {
    case 'reply': return 'bg-blue-50'
    case 'like': return 'bg-pink-50'
    case 'follow': return 'bg-green-50'
    default: return 'bg-gray-50'
  }
}
