import { create } from 'zustand'
import type { Notification, NotificationSettings, NotificationType } from '@/types'
import { get, post, patch, put } from '@/api/client'

interface NotificationState {
  // State
  notifications: Notification[]
  unreadCount: number
  totalCount: number
  settings: NotificationSettings
  isLoading: boolean
  error: string | null
  currentPage: number
  hasMore: boolean
  isConnected: boolean

  // Actions
  fetchNotifications: (page?: number, type?: NotificationType) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  fetchUnreadCount: () => Promise<void>
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>
  fetchSettings: () => Promise<void>
  addNotification: (notification: Notification) => void
  setConnected: (connected: boolean) => void
  clearAll: () => void
}

const defaultSettings: NotificationSettings = {
  reply: true,
  like: true,
  follow: true,
  system: true,
  video: true,
  email: false,
  push: true,
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  // Initial state
  notifications: [],
  unreadCount: 0,
  totalCount: 0,
  settings: { ...defaultSettings },
  isLoading: false,
  error: null,
  currentPage: 1,
  hasMore: true,
  isConnected: false,

  // Fetch notifications
  fetchNotifications: async (page = 1, type?: NotificationType) => {
    set({ isLoading: true, error: null })
    try {
      const params: Record<string, unknown> = { page, pageSize: 20 }
      if (type) params.type = type

      const { list, total } = await get<{ list: Notification[]; total: number }>('/notifications', params)
      set({
        notifications: page === 1 ? list : [...get().notifications, ...list],
        totalCount: total,
        hasMore: list.length === 20,
        currentPage: page,
        isLoading: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err?.message || '获取通知失败', isLoading: false })
    }
  },

  // Mark single notification as read
  markAsRead: async (notificationId: string) => {
    try {
      await patch(`/notifications/${notificationId}/read`, {})
      set({
        notifications: get().notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, get().unreadCount - 1),
      })
    } catch (error: unknown) {
      console.error('Failed to mark as read:', error)
    }
  },

  // Mark all as read
  markAllAsRead: async () => {
    try {
      await post('/notifications/read-all', {})
      set({
        notifications: get().notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      })
    } catch (error: unknown) {
      console.error('Failed to mark all as read:', error)
    }
  },

  // Delete notification
  deleteNotification: async (notificationId: string) => {
    try {
      await post(`/notifications/${notificationId}/delete`, {})
      const deleted = get().notifications.find((n) => n.id === notificationId)
      set({
        notifications: get().notifications.filter((n) => n.id !== notificationId),
        totalCount: get().totalCount - 1,
        unreadCount: deleted && !deleted.isRead
          ? Math.max(0, get().unreadCount - 1)
          : get().unreadCount,
      })
    } catch (error: unknown) {
      console.error('Failed to delete notification:', error)
    }
  },

  // Fetch unread count
  fetchUnreadCount: async () => {
    try {
      const { count } = await get<{ count: number }>('/notifications/unread-count')
      set({ unreadCount: count })
    } catch (error: unknown) {
      console.error('Failed to fetch unread count:', error)
    }
  },

  // Update notification settings
  updateSettings: async (settings: Partial<NotificationSettings>) => {
    try {
      const newSettings = { ...get().settings, ...settings }
      await put('/notifications/settings', newSettings)
      set({ settings: newSettings })
    } catch (error: unknown) {
      console.error('Failed to update settings:', error)
    }
  },

  // Fetch notification settings
  fetchSettings: async () => {
    try {
      const settings = await get<NotificationSettings>('/notifications/settings')
      set({ settings })
    } catch (error: unknown) {
      console.error('Failed to fetch settings:', error)
    }
  },

  // Add notification (from WebSocket)
  addNotification: (notification: Notification) => {
    set({
      notifications: [notification, ...get().notifications].slice(0, 100),
      unreadCount: notification.isRead ? get().unreadCount : get().unreadCount + 1,
      totalCount: get().totalCount + 1,
    })
  },

  // Set WebSocket connection status
  setConnected: (connected: boolean) => {
    set({ isConnected: connected })
  },

  // Clear all notifications
  clearAll: () => {
    set({
      notifications: [],
      unreadCount: 0,
      totalCount: 0,
      currentPage: 1,
      hasMore: true,
    })
  },
}))

// Selector hooks
export const useNotifications = () => useNotificationStore((state) => state.notifications)
export const useUnreadCount = () => useNotificationStore((state) => state.unreadCount)
export const useNotificationLoading = () => useNotificationStore((state) => state.isLoading)
