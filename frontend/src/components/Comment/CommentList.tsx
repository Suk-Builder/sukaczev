import { useState, useEffect, useRef, useCallback } from 'react'
import type { Comment as CommentType } from '@/types'
import { useVideoStore } from '@/stores/videoStore'
import { CommentItem } from './CommentItem'
import { CommentForm } from './CommentForm'
import { formatNumber } from '@/utils/format'

interface CommentListProps {
  videoId: string
}

export function CommentList({ videoId }: CommentListProps) {
  const { commentList, commentTotal, commentLoading, fetchComments } = useVideoStore()
  const [sortBy, setSortBy] = useState<'time' | 'hot'>('hot')
  const [currentPage, setCurrentPage] = useState(1)
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const hasLoadedRef = useRef(false)

  // Initial fetch
  useEffect(() => {
    if (!hasLoadedRef.current && videoId) {
      hasLoadedRef.current = true
      fetchComments(videoId, 1)
    }
  }, [videoId, fetchComments])

  // Sort change
  const handleSort = useCallback(
    (sort: 'time' | 'hot') => {
      if (sort === sortBy) return
      setSortBy(sort)
      setCurrentPage(1)
      // Re-fetch with sort
      fetchComments(videoId, 1)
    },
    [sortBy, videoId, fetchComments]
  )

  // Load more
  const loadMore = useCallback(() => {
    const nextPage = currentPage + 1
    setCurrentPage(nextPage)
    fetchComments(videoId, nextPage)
  }, [currentPage, videoId, fetchComments])

  // Reply handler
  const handleReply = useCallback((id: string, username: string) => {
    setReplyTo({ id, username })
    // Scroll to comment form
    const formEl = document.getElementById('comment-form-anchor')
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // Cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyTo(null)
  }, [])

  // Sorted comments
  const sortedComments = [...commentList].sort((a, b) => {
    if (sortBy === 'hot') {
      return b.likes - a.likes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div ref={listRef} className="bg-white rounded-xl p-5 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-bili-text-primary">
            评论 <span className="text-sm text-bili-text-tertiary font-normal ml-1">{formatNumber(commentTotal)}</span>
          </h3>
        </div>
        <div className="flex items-center gap-1 bg-bili-bg rounded-lg p-0.5">
          <button
            onClick={() => handleSort('hot')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sortBy === 'hot' ? 'bg-white text-bili-text-primary shadow-sm' : 'text-bili-text-tertiary hover:text-bili-text-secondary'
            }`}
          >
            最热
          </button>
          <button
            onClick={() => handleSort('time')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sortBy === 'time' ? 'bg-white text-bili-text-primary shadow-sm' : 'text-bili-text-tertiary hover:text-bili-text-secondary'
            }`}
          >
            最新
          </button>
        </div>
      </div>

      {/* Comment Form */}
      <div id="comment-form-anchor" className="mb-6">
        <CommentForm
          videoId={videoId}
          replyTo={replyTo}
          onCancelReply={handleCancelReply}
          onSubmit={() => setReplyTo(null)}
        />
      </div>

      {/* Comment List */}
      <div className="space-y-4">
        {sortedComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={handleReply}
            depth={0}
          />
        ))}
      </div>

      {/* Loading */}
      {commentLoading && (
        <div className="py-6 flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 text-bili-text-tertiary" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Load More */}
      {!commentLoading && sortedComments.length < commentTotal && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            className="px-6 py-2 bg-bili-bg text-bili-text-secondary text-sm font-medium rounded-lg hover:bg-bili-border-light transition-colors"
          >
            加载更多评论
          </button>
        </div>
      )}

      {/* Empty State */}
      {!commentLoading && sortedComments.length === 0 && (
        <div className="py-12 flex flex-col items-center text-bili-text-tertiary">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="mb-3 opacity-30">
            <circle cx="30" cy="30" r="28" stroke="currentColor" strokeWidth="2" />
            <path d="M18 36c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="22" cy="24" r="2" fill="currentColor" />
            <circle cx="38" cy="24" r="2" fill="currentColor" />
          </svg>
          <p className="text-sm font-medium">暂无评论</p>
          <p className="text-xs mt-1 opacity-60">来发表第一条评论吧</p>
        </div>
      )}
    </div>
  )
}
