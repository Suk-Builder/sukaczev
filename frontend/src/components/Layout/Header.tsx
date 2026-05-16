import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore, useUser, useIsAuthenticated } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAuth } from '@/hooks/useAuth'
import { debounce } from '@/utils/format'

// SVG Icons as components for clarity
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.333 12.667A5.333 5.333 0 107.333 2a5.333 5.333 0 000 10.667zM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.5 6a4.5 4.5 0 10-9 0c0 5.25-2.25 6.75-2.25 6.75h13.5S13.5 11.25 13.5 6zM10.163 14.52a1.5 1.5 0 01-2.594 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const UploadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 10v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2M12 6L8 2 4 6M8 2v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#FB7299"/>
    <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 1.5l1.8 3.7 4.2.6-3 3 1 4.2L8 11.2l-4 2.5 1-4.2-3-3 4.2-.6L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
)

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M3 13.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 4V2.5A1.5 1.5 0 017.5 1h5A1.5 1.5 0 0114 2.5v11a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 016 13.5V12M9.5 8H2m0 0l2.5-2.5M2 8l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useIsAuthenticated()
  const user = useUser()
  const { logout } = useAuth()
  const unreadCount = useNotificationStore((state) => state.unreadCount)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Load hot searches
  const fetchSuggestions = useCallback(
    debounce((query: string) => {
      if (query.trim()) {
        // Mock suggestions
        setSearchSuggestions([
          `${query} 相关视频`,
          `${query} 教程`,
          `${query} 合集`,
          `${query} 精彩瞬间`,
          `${query} 最新`,
        ])
      } else {
        setSearchSuggestions([])
      }
    }, 200),
    []
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    fetchSuggestions(val)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchFocused(false)
      setSearchQuery('')
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    navigate(`/search?q=${encodeURIComponent(suggestion)}`)
    setSearchFocused(false)
    setSearchQuery('')
  }

  // Hot searches
  const hotSearches = ['原神', '鬼畜', '美食', '科技', '音乐', '舞蹈', '游戏', '动漫']

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-bili-header text-white">
      <div className="bili-container">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Navigation */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <LogoIcon />
              <span className="text-xl font-bold tracking-tight hidden sm:block">Sukačev</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {[
                { label: '首页', path: '/' },
                { label: '番剧', path: '/category/anime' },
                { label: '直播', path: '/category/live' },
                { label: '游戏中心', path: '/category/game' },
                { label: '会员购', path: '/vip' },
                { label: '漫画', path: '/comic' },
                { label: '赛事', path: '/match' },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md mx-6 hidden md:block" ref={searchRef}>
            <form onSubmit={handleSearch} className="relative">
              <div
                className={`flex items-center bg-white/10 rounded-lg border transition-all duration-200 ${
                  searchFocused ? 'border-bili-pink bg-white/15' : 'border-transparent'
                }`}
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => {
                    setSearchFocused(true)
                    if (!searchQuery.trim()) {
                      setSearchSuggestions(hotSearches)
                    }
                  }}
                  placeholder="搜索视频、UP主、番剧..."
                  className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-white/40 outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-white/60 hover:text-bili-pink transition-colors"
                >
                  <SearchIcon />
                </button>
              </div>

              {/* Search Suggestions Dropdown */}
              {searchFocused && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-bili-border overflow-hidden animate-slide-down">
                  {searchQuery.trim() === '' ? (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-bili-text-primary">热搜榜</span>
                        <Link to="/search?t=hot" className="text-xs text-bili-text-tertiary hover:text-bili-pink">
                          查看全部
                        </Link>
                      </div>
                      <div className="space-y-2">
                        {hotSearches.map((keyword, index) => (
                          <button
                            key={keyword}
                            onClick={() => handleSuggestionClick(keyword)}
                            className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-bili-bg transition-colors text-left"
                          >
                            <span
                              className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold ${
                                index < 3
                                  ? 'bg-bili-pink text-white'
                                  : 'bg-bili-bg text-bili-text-secondary'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="text-sm text-bili-text-primary">{keyword}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-2">
                      {searchSuggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSuggestionClick(s)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bili-bg transition-colors text-left"
                        >
                          <SearchIcon />
                          <span className="text-sm text-bili-text-primary">{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Mobile search toggle */}
            <button
              className="md:hidden p-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
            >
              <SearchIcon />
            </button>

            {/* Upload */}
            <Link
              to="/upload"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-bili-pink text-white text-sm font-medium rounded-lg hover:bg-bili-pink-dark transition-colors"
            >
              <UploadIcon />
              投稿
            </Link>

            {/* Notifications */}
            {isAuthenticated && (
              <button
                onClick={() => navigate('/profile?tab=notifications')}
                className="relative p-2 text-white/70 hover:text-white transition-colors"
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-0.5 w-4 h-4 bg-bili-pink text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <img
                    src={user?.avatar || '/default-avatar.png'}
                    alt={user?.nickname || '用户'}
                    className="w-9 h-9 rounded-full object-cover border-2 border-white/20"
                  />
                  <span className="hidden lg:block text-sm font-medium">{user?.nickname}</span>
                  <span className="hidden lg:block text-white/40">
                    <ChevronDownIcon />
                  </span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-bili-border py-2 animate-slide-down z-50">
                    <div className="px-4 py-3 border-b border-bili-border-light">
                      <div className="flex items-center gap-3">
                        <img
                          src={user?.avatar || '/default-avatar.png'}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <div className="text-sm font-semibold text-bili-text-primary">{user?.nickname}</div>
                          <div className="text-xs text-bili-text-tertiary">Lv{user?.level || 1}</div>
                        </div>
                      </div>
                    </div>
                    <div className="py-1">
                      <Link
                        to={`/space/${user?.uid}`}
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-bili-text-primary hover:bg-bili-bg transition-colors"
                      >
                        <UserIcon />
                        个人中心
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-bili-text-primary hover:bg-bili-bg transition-colors"
                      >
                        <StarIcon />
                        我的收藏
                      </Link>
                      <Link
                        to="/profile?tab=history"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-bili-text-primary hover:bg-bili-bg transition-colors"
                      >
                        <HistoryIcon />
                        历史记录
                      </Link>
                    </div>
                    <div className="border-t border-bili-border-light py-1">
                      <button
                        onClick={() => {
                          logout()
                          setShowUserMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <LogoutIcon />
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-bili-pink text-white text-sm font-medium rounded-lg hover:bg-bili-pink-dark transition-colors"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {showMobileSearch && (
        <div className="md:hidden px-4 pb-3 animate-slide-down">
          <form onSubmit={handleSearch} className="relative">
            <div className="flex items-center bg-white/10 rounded-lg border border-bili-pink">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="搜索..."
                autoFocus
                className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-white/40 outline-none"
              />
              <button type="submit" className="px-4 py-2 text-white/60">
                <SearchIcon />
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  )
}
