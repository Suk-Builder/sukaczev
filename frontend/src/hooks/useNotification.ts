import { useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useNotificationStore } from '@/stores/notificationStore'
import type { Notification } from '@/types'

/**
 * Hook for notification management with WebSocket
 */
export function useNotification() {
  const store = useNotificationStore()

  // Initialize WebSocket for notifications
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin
    const socket: Socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    })

    socket.on('connect', () => {
      store.setConnected(true)
    })

    socket.on('disconnect', () => {
      store.setConnected(false)
    })

    socket.on('notification', (notification: Notification) => {
      store.addNotification(notification)
      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.content,
          icon: '/favicon.svg',
        })
      }
    })

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      socket.disconnect()
    }
  }, [])

  // Fetch initial unread count
  useEffect(() => {
    if (store.isConnected) {
      store.fetchUnreadCount()
    }
  }, [store.isConnected])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      await store.markAsRead(notificationId)
    },
    [store]
  )

  const markAllAsRead = useCallback(async () => {
    await store.markAllAsRead()
  }, [store])

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      await store.deleteNotification(notificationId)
    },
    [store]
  )

  const loadMore = useCallback(
    async (type?: Notification['type']) => {
      if (store.hasMore && !store.isLoading) {
        await store.fetchNotifications(store.currentPage + 1, type)
      }
    },
    [store]
  )

  return {
    // State
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    totalCount: store.totalCount,
    isLoading: store.isLoading,
    isConnected: store.isConnected,
    hasMore: store.hasMore,

    // Actions
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    fetchNotifications: store.fetchNotifications,
    fetchUnreadCount: store.fetchUnreadCount,
  }
}

/**
 * Hook for browser notification permission
 */
export function useBrowserNotification() {
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return false
    }
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }, [])

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (Notification.permission === 'granted') {
        return new Notification(title, {
          icon: '/favicon.svg',
          ...options,
        })
      }
      return null
    },
    []
  )

  return {
    isSupported: 'Notification' in window,
    permission: Notification.permission,
    requestPermission,
    sendNotification,
  }
}

/**
 * Hook for notification sound
 */
export function useNotificationSound() {
  const playSound = useCallback(() => {
    const audio = new Audio('/notification.mp3')
    audio.volume = 0.5
    audio.play().catch(() => {
      // Audio play failed (user interaction required)
    })
  }, [])

  return { playSound }
}

/**
 * Hook for unread badge on tab
 */
export function useTabBadge() {
  const setBadge = useCallback((count: number) => {
    if (count > 0) {
      document.title = `(${count}) Sukačev - 视频分享平台`
    } else {
      document.title = 'Sukačev - 视频分享平台'
    }
  }, [])

  const clearBadge = useCallback(() => {
    document.title = 'Sukačev - 视频分享平台'
  }, [])

  return { setBadge, clearBadge }
}

/**
 * Hook for polling notifications (fallback when WebSocket is not available)
 */
export function useNotificationPolling(interval: number = 60000) {
  const { fetchUnreadCount, fetchNotifications } = useNotificationStore()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    // Initial fetch
    fetchUnreadCount()

    const timer = setInterval(() => {
      fetchUnreadCount()
    }, interval)

    return () => clearInterval(timer)
  }, [interval, fetchUnreadCount, fetchNotifications])
}
