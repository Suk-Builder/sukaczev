import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { UserSimple, User } from '@/types'
import { formatNumber, getLevelColor, getLevelBgColor } from '@/utils/format'
import { FollowButton } from './FollowButton'

interface UserCardProps {
  user: UserSimple | User
  variant?: 'compact' | 'default' | 'detailed'
  showFollowButton?: boolean
  className?: string
}

export function UserCard({ user, variant = 'default', showFollowButton = true, className = '' }: UserCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  if (variant === 'compact') {
    return (
      <Link
        to={`/space/${user.uid}`}
        className={`flex items-center gap-2 group ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={user.avatar}
          alt={user.nickname}
          className="w-6 h-6 rounded-full object-cover group-hover:ring-2 group-hover:ring-bili-pink/30 transition-all"
        />
        <span className="text-xs text-bili-text-tertiary group-hover:text-bili-pink transition-colors truncate">
          {user.nickname}
        </span>
      </Link>
    )
  }

  if (variant === 'detailed') {
    const fullUser = user as User
    return (
      <div
        className={`bg-white rounded-xl p-5 shadow-card ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Cover & Avatar */}
        <div className="relative">
          <div className="h-20 bg-gradient-to-r from-bili-pink/20 to-bili-blue/20 rounded-lg" />
          <div className="absolute -bottom-8 left-4">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.nickname}
                className="w-16 h-16 rounded-full object-cover border-4 border-white"
              />
              {fullUser.isVip && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-bili-pink rounded-full flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M5 1l1.2 2.5L9 4l-2 2 .5 2.5L5 7.5 2.5 8.5l.5-2.5-2-2 2.8-.5L5 1z" fill="white" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-bili-text-primary">{user.nickname}</h3>
                <span
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded"
                  style={{
                    color: getLevelColor(fullUser.level || 1),
                    backgroundColor: getLevelBgColor(fullUser.level || 1),
                  }}
                >
                  Lv{fullUser.level || 1}
                </span>
              </div>
              <p className="mt-1 text-xs text-bili-text-tertiary line-clamp-1">{user.signature || '这个人很懒，没有写签名~'}</p>
            </div>
            {showFollowButton && <FollowButton uid={user.uid} size="sm" />}
          </div>

          {/* Stats */}
          <div className="mt-3 flex items-center gap-4">
            <div className="text-center">
              <div className="text-sm font-bold text-bili-text-primary">{formatNumber(fullUser.following || 0)}</div>
              <div className="text-[10px] text-bili-text-tertiary">关注</div>
            </div>
            <div className="w-px h-6 bg-bili-border" />
            <div className="text-center">
              <div className="text-sm font-bold text-bili-text-primary">{formatNumber(fullUser.followers || 0)}</div>
              <div className="text-[10px] text-bili-text-tertiary">粉丝</div>
            </div>
            <div className="w-px h-6 bg-bili-border" />
            <div className="text-center">
              <div className="text-sm font-bold text-bili-text-primary">{formatNumber(fullUser.likes || 0)}</div>
              <div className="text-[10px] text-bili-text-tertiary">获赞</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <Link
      to={`/space/${user.uid}`}
      className={`flex items-center gap-3 group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative flex-shrink-0">
        <img
          src={user.avatar}
          alt={user.nickname}
          className="w-10 h-10 rounded-full object-cover group-hover:ring-2 group-hover:ring-bili-pink/40 transition-all"
        />
        {(user as User).isVip && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-bili-pink rounded-full flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M5 1l1.2 2.5L9 4l-2 2 .5 2.5L5 7.5 2.5 8.5l.5-2.5-2-2 2.8-.5L5 1z" fill="white" />
            </svg>
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-bili-text-primary group-hover:text-bili-pink transition-colors truncate">
            {user.nickname}
          </span>
        </div>
        <p className="text-xs text-bili-text-tertiary truncate">{user.signature || '暂无签名'}</p>
      </div>
      {showFollowButton && <FollowButton uid={user.uid} size="sm" />}
    </Link>
  )
}

/**
 * User avatar with hover popup
 */
export function UserAvatar({
  user,
  size = 'md',
  showPopup = true,
}: {
  user: UserSimple
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showPopup?: boolean
}) {
  const [showCard, setShowCard] = useState(false)
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowCard(true)}
      onMouseLeave={() => setShowCard(false)}
    >
      <Link to={`/space/${user.uid}`}>
        <img
          src={user.avatar}
          alt={user.nickname}
          className={`${sizeClasses[size]} rounded-full object-cover hover:ring-2 hover:ring-bili-pink/40 transition-all`}
        />
      </Link>

      {/* Hover Popup */}
      {showPopup && showCard && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-xl shadow-xl border border-bili-border animate-slide-down">
          <UserCard user={user} variant="detailed" showFollowButton className="shadow-none border-0" />
        </div>
      )}
    </div>
  )
}
