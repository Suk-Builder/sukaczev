import { useState, useCallback } from 'react'
import type { Comment } from '@/types'
import { formatNumber } from '@/utils/format'
import { timeAgo } from '@/utils/time'
import { useVideoStore } from '@/stores/videoStore'
import { CommentForm } from './CommentForm'

interface CommentItemProps {
  comment: Comment
  onReply: (id: string, username: string) => void
  depth: number
  videoId?: string
}

export function CommentItem({ comment, onReply, depth = 0, videoId }: CommentItemProps) {
  const { likeComment } = useVideoStore()
  const [showReplies, setShowReplies] = useState(depth < 1)
  const [isLiking, setIsLiking] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [localLikes, setLocalLikes] = useState(comment.likes)
  const [localIsLiked, setLocalIsLiked] = useState(comment.isLiked)
  const [expanded, setExpanded] = useState(false)

  const handleLike = useCallback(async () => {
    if (isLiking) return
    setIsLiking(true)
    try {
      await likeComment(comment.id)
      setLocalLikes((prev) => prev + 1)
      setLocalIsLiked(true)
    } catch {
      // Already liked or error
    } finally {
      setIsLiking(false)
    }
  }, [comment.id, isLiking, likeComment])

  const handleReply = useCallback(() => {
    if (depth >= 2) {
      // For deep nesting, use the parent reply mechanism
      onReply(comment.id, comment.user.nickname)
    } else {
      setShowReplyForm(!showReplyForm)
    }
  }, [comment.id, comment.user.nickname, depth, onReply, showReplyForm])

  const hasLongContent = comment.content.length > 200
  const displayContent = expanded || !hasLongContent ? comment.content : comment.content.slice(0, 200) + '...'

  const isReply = depth > 0

  return (
    <div className={`${isReply ? 'ml-12 border-l-2 border-bili-border-light pl-4' : 'border-b border-bili-border-light last:border-0'} pb-4`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <img
            src={comment.user.avatar}
            alt={comment.user.nickname}
            className="w-9 h-9 rounded-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* User Info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-bili-text-primary hover:text-bili-pink cursor-pointer transition-colors">
              {comment.user.nickname}
            </span>
            {comment.user.isVip && (
              <span className="px-1 py-0.5 bg-bili-pink text-white text-[9px] font-bold rounded leading-none">
                VIP
              </span>
            )}
            <span className="text-xs text-bili-text-tertiary">{timeAgo(comment.createdAt)}</span>
          </div>

          {/* Comment Content */}
          <div className="mt-1.5 text-sm text-bili-text-primary leading-relaxed whitespace-pre-wrap break-words">
            {displayContent}
            {hasLongContent && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="ml-1 text-bili-pink text-xs hover:underline"
              >
                展开
              </button>
            )}
            {hasLongContent && expanded && (
              <button
                onClick={() => setExpanded(false)}
                className="ml-1 text-bili-text-tertiary text-xs hover:underline"
              >
                收起
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={handleLike}
              disabled={isLiking || localIsLiked}
              className={`flex items-center gap-1 text-xs transition-colors ${
                localIsLiked
                  ? 'text-bili-pink'
                  : 'text-bili-text-tertiary hover:text-bili-text-primary'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 12V6H1v6h2zm8-4.5c0-.3-.1-.5-.3-.7l-.7-.7c-.4-.4-1-.4-1.4 0L8 6.6V3c0-.6-.4-1-1-1s-1 .4-1 1v5.5l-.8-.8c-.4-.4-1-.4-1.4 0l-.6.7c-.2.2-.2.4-.2.7s.1.5.3.7l3.5 3.5c.2.2.4.3.7.3h3c.6 0 1-.4 1-1V7.5z"
                  fill={localIsLiked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={localIsLiked ? '0' : '1'}
                />
              </svg>
              {formatNumber(localLikes)}
            </button>

            <button
              onClick={handleReply}
              className="flex items-center gap-1 text-xs text-bili-text-tertiary hover:text-bili-text-primary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12 7.5a5.5 5.5 0 10-2 4.25L12 13v-1.5l-.5-.5A5.48 5.48 0 0012 7.5z" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              回复
            </button>

            <button className="flex items-center gap-1 text-xs text-bili-text-tertiary hover:text-bili-text-primary transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              分享
            </button>

            <button className="text-xs text-bili-text-tertiary hover:text-bili-text-primary transition-colors">
              举报
            </button>
          </div>

          {/* Reply Form */}
          {showReplyForm && depth < 2 && (
            <div className="mt-3">
              <CommentForm
                videoId={videoId || ''}
                parentId={comment.id}
                replyTo={{ id: comment.id, username: comment.user.nickname }}
                onCancelReply={() => setShowReplyForm(false)}
                onSubmit={() => setShowReplyForm(false)}
              />
            </div>
          )}

          {/* Nested Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
              {depth === 0 && comment.replies.length > 2 && !showReplies ? (
                <button
                  onClick={() => setShowReplies(true)}
                  className="flex items-center gap-1 text-xs text-bili-pink hover:underline"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  查看全部 {comment.replyCount} 条回复
                </button>
              ) : (
                <div className="space-y-3">
                  {comment.replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      onReply={onReply}
                      depth={depth + 1}
                      videoId={videoId}
                    />
                  ))}
                  {depth === 0 && comment.replies.length > 2 && (
                    <button
                      onClick={() => setShowReplies(false)}
                      className="flex items-center gap-1 text-xs text-bili-text-tertiary hover:text-bili-pink transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="rotate-180">
                        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      收起回复
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
