import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, LoginForm, RegisterForm, AuthResponse } from '@/types'
import { post } from '@/api/client'

interface AuthState {
  // State
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (form: LoginForm) => Promise<void>
  register: (form: RegisterForm) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  updateUser: (updates: Partial<User>) => void
  refreshAuth: () => Promise<void>
  clearError: () => void
  followUser: (uid: string) => Promise<void>
  unfollowUser: (uid: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: localStorage.getItem('token'),
      refreshToken: localStorage.getItem('refreshToken'),
      isAuthenticated: !!localStorage.getItem('token'),
      isLoading: false,
      error: null,

      // Login action
      login: async (form: LoginForm) => {
        set({ isLoading: true, error: null })
        try {
          const response = await post<AuthResponse>('/auth/login', form)
          localStorage.setItem('token', response.token)
          localStorage.setItem('refreshToken', response.refreshToken)
          localStorage.setItem('tokenExpires', (Date.now() + response.expiresIn * 1000).toString())
          set({
            user: response.user,
            token: response.token,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error: unknown) {
          const err = error as { message?: string }
          set({
            error: err?.message || '登录失败',
            isLoading: false,
          })
          throw error
        }
      },

      // Register action
      register: async (form: RegisterForm) => {
        set({ isLoading: true, error: null })
        try {
          const response = await post<AuthResponse>('/auth/register', form)
          localStorage.setItem('token', response.token)
          localStorage.setItem('refreshToken', response.refreshToken)
          localStorage.setItem('tokenExpires', (Date.now() + response.expiresIn * 1000).toString())
          set({
            user: response.user,
            token: response.token,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error: unknown) {
          const err = error as { message?: string }
          set({
            error: err?.message || '注册失败',
            isLoading: false,
          })
          throw error
        }
      },

      // Logout action
      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('tokenExpires')
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      // Set user directly
      setUser: (user: User) => {
        set({ user, isAuthenticated: true })
      },

      // Update user partial data
      updateUser: (updates: Partial<User>) => {
        const current = get().user
        if (current) {
          set({ user: { ...current, ...updates } })
        }
      },

      // Refresh auth token
      refreshAuth: async () => {
        const refresh = get().refreshToken
        if (!refresh) return
        try {
          const response = await post<AuthResponse>('/auth/refresh', { refreshToken: refresh })
          localStorage.setItem('token', response.token)
          localStorage.setItem('refreshToken', response.refreshToken)
          set({
            token: response.token,
            refreshToken: response.refreshToken,
            user: response.user,
            isAuthenticated: true,
          })
        } catch {
          get().logout()
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Follow user
      followUser: async (uid: string) => {
        await post(`/users/${uid}/follow`, {})
        const user = get().user
        if (user) {
          set({ user: { ...user, following: user.following + 1 } })
        }
      },

      // Unfollow user
      unfollowUser: async (uid: string) => {
        await post(`/users/${uid}/unfollow`, {})
        const user = get().user
        if (user) {
          set({ user: { ...user, following: Math.max(0, user.following - 1) } })
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Selector hooks for better performance
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useAuthLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthError = () => useAuthStore((state) => state.error)
