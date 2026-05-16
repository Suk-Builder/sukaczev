import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useVideoStore } from '@/stores/videoStore'

interface SidebarItem {
  icon: React.ReactNode
  label: string
  path: string
  children?: { label: string; path: string }[]
}

// SVG Icons
const HomeIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 8l7-5 7 5v8a1 1 0 01-1 1H4a1 1 0 01-1-1V8z"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 19V11h4v8"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const TrendingIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13 7l-3-5-3 5M7 13l3 5 3-5"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="10"
      cy="10"
      r="2"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
    />
  </svg>
)

const AnimeIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 2a8 8 0 100 16 8 8 0 000-16z"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
    />
    <path
      d="M7.5 8.5s.5-1.5 2.5-1.5 2.5 1.5 2.5 1.5M7 12.5s1.5 1.5 3 1.5 3-1.5 3-1.5"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
)

const MusicIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7 16V5l10-3v11"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="5"
      cy="16"
      r="2"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
    />
    <circle
      cx="15"
      cy="13"
      r="2"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
    />
  </svg>
)

const GameIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="2"
      y="4"
      width="16"
      height="12"
      rx="2"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
    />
    <path
      d="M7 10h2M8 9v2M11 10h.01M13 9h.01M13 11h.01"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
)

const TechIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="3"
      y="6"
      width="14"
      height="9"
      rx="1"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
    />
    <path
      d="M7 6V4.5a1 1 0 011-1h4a1 1 0 011 1V6M10 13v-1.5"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const KnowledgeIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 2L2 6v8l8 4 8-4V6l-8-4z"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M10 10V6M6 8l4 2 4-2"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const LifeIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 10c0-4 3.5-7 7-7s7 3 7 7-3.5 7-7 7c-1.5 0-3-.5-4-1.5L3 17l1.5-3C3.5 12.5 3 11.5 3 10z"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
)

const StarIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 2l2.5 5.5L18 8.3l-4 4.2.9 5.5L10 15.3l-4.9 2.7.9-5.5-4-4.2 5.5-.8L10 2z"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
)

const ClockIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle
      cx="10"
      cy="10"
      r="7"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
    />
    <path
      d="M10 6.5V10l2.5 1.5"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const UploadIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 4v12M5 8l5-4 5 4"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ActivityIcon = ({ active }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 10l3-4 3 5 3-2 3 4"
      stroke={active ? '#FB7299' : '#61666D'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="16"
      cy="4"
      r="2"
      fill="#FB7299"
    />
  </svg>
)

export function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const { categories, fetchCategories } = useVideoStore()

  useEffect(() => {
    if (categories.length === 0) {
      fetchCategories()
    }
  }, [categories.length, fetchCategories])

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const mainItems: SidebarItem[] = [
    { icon: <HomeIcon active />, label: '首页', path: '/' },
    { icon: <TrendingIcon active />, label: '动态', path: '/trending' },
    { icon: <ActivityIcon active />, label: '热门', path: '/popular' },
  ]

  const categoryItems: SidebarItem[] = [
    { icon: <AnimeIcon active />, label: '动画', path: '/category/anime' },
    { icon: <MusicIcon active />, label: '音乐', path: '/category/music' },
    { icon: <GameIcon active />, label: '游戏', path: '/category/game' },
    { icon: <TechIcon active />, label: '科技', path: '/category/tech' },
    { icon: <KnowledgeIcon active />, label: '知识', path: '/category/knowledge' },
    { icon: <LifeIcon active />, label: '生活', path: '/category/life' },
  ]

  const personalItems: SidebarItem[] = [
    { icon: <StarIcon active />, label: '我的收藏', path: '/profile?tab=favorites' },
    { icon: <ClockIcon active />, label: '历史记录', path: '/profile?tab=history' },
    { icon: <UploadIcon active />, label: '我的投稿', path: '/profile?tab=videos' },
  ]

  const renderItem = (item: SidebarItem) => {
    const active = isActive(item.path)
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
          active
            ? 'bg-bili-pink-light text-bili-pink'
            : 'text-bili-text-secondary hover:bg-bili-bg hover:text-bili-text-primary'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <span className="flex-shrink-0">
          {active ? item.icon : <span className="opacity-70">{item.icon}</span>}
        </span>
        <span className={`text-sm font-medium whitespace-nowrap transition-opacity ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <aside
      className={`fixed left-0 top-16 bottom-0 bg-white border-r border-bili-border overflow-y-auto scrollbar-hide transition-all duration-300 z-40 hidden lg:block ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div className="p-3">
        {/* Main Navigation */}
        <nav className="space-y-0.5 mb-2">
          {mainItems.map(renderItem)}
        </nav>

        {/* Divider */}
        <div className="border-t border-bili-border-light my-2" />

        {/* Categories */}
        <div className={collapsed ? 'hidden' : 'mb-1 px-3'}>
          <span className="text-xs font-medium text-bili-text-tertiary uppercase tracking-wider">频道</span>
        </div>
        <nav className="space-y-0.5 mb-2">
          {categoryItems.map(renderItem)}
        </nav>

        {/* Divider */}
        <div className="border-t border-bili-border-light my-2" />

        {/* Personal */}
        <div className={collapsed ? 'hidden' : 'mb-1 px-3'}>
          <span className="text-xs font-medium text-bili-text-tertiary uppercase tracking-wider">我的</span>
        </div>
        <nav className="space-y-0.5">
          {personalItems.map(renderItem)}
        </nav>

        {/* Dynamic Categories from API */}
        {categories.length > 0 && (
          <>
            <div className="border-t border-bili-border-light my-2" />
            <div className={collapsed ? 'hidden' : 'mb-1 px-3'}>
              <span className="text-xs font-medium text-bili-text-tertiary uppercase tracking-wider">更多</span>
            </div>
            <nav className="space-y-0.5">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group ${
                    isActive(`/category/${cat.slug}`)
                      ? 'bg-bili-pink-light text-bili-pink'
                      : 'text-bili-text-secondary hover:bg-bili-bg hover:text-bili-text-primary'
                  }`}
                >
                  <span className="w-5 h-5 flex items-center justify-center text-sm">{cat.icon}</span>
                  <span className={`text-sm font-medium whitespace-nowrap transition-opacity ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    {cat.name}
                  </span>
                </Link>
              ))}
            </nav>
          </>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute bottom-4 right-0 translate-x-1/2 w-7 h-7 bg-white border border-bili-border rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow z-50"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
        >
          <path d="M8 3L4 6l4 3" stroke="#61666D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </aside>
  )
}
