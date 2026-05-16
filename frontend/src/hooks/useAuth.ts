import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useUser, useIsAuthenticated } from '@/stores/authStore'

/**
 * Authentication hook with common auth operations
 */
export function useAuth() {
  const navigate = useNavigate()
  const user = useUser()
  const isAuthenticated = useIsAuthenticated()
  const { login, register, logout, clearError, refreshAuth, isLoading, error } = useAuthStore()

  // Check token expiration on mount
  useEffect(() => {
    const tokenExpires = localStorage.getItem('tokenExpires')
    if (tokenExpires) {
      const expiresAt = parseInt(tokenExpires, 10)
      if (Date.now() >= expiresAt - 5 * 60 * 1000) {
        // Refresh if expiring in 5 minutes
        refreshAuth()
      }
    }
  }, [refreshAuth])

  // Login with redirect
  const handleLogin = useCallback(
    async (form: { username: string; password: string; remember?: boolean }) => {
      await login(form)
      const redirect = new URLSearchParams(window.location.search).get('redirect')
      navigate(redirect || '/')
    },
    [login, navigate]
  )

  // Register with redirect
  const handleRegister = useCallback(
    async (form: {
      username: string
      password: string
      confirmPassword: string
      nickname: string
      email?: string
      phone?: string
      gender: 'male' | 'female' | 'secret'
      birthday?: string
      agreement: boolean
    }) => {
      await register(form)
      navigate('/')
    },
    [register, navigate]
  )

  // Logout with redirect
  const handleLogout = useCallback(() => {
    logout()
    navigate('/')
  }, [logout, navigate])

  // Require auth - redirect to login if not authenticated
  const requireAuth = useCallback(
    (callback: () => void) => {
      if (!isAuthenticated) {
        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      callback()
    },
    [isAuthenticated, navigate]
  )

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,

    // Actions
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    clearError,
    refreshAuth,
    requireAuth,
  }
}

/**
 * Hook to check if user has required level
 */
export function useRequireLevel(minLevel: number) {
  const user = useUser()
  return {
    hasLevel: (user?.level ?? 0) >= minLevel,
    userLevel: user?.level ?? 0,
  }
}

/**
 * Hook to get user level color
 */
export function useUserLevelColor() {
  const user = useUser()

  const getLevelColor = useCallback((level: number = user?.level ?? 1) => {
    const colors: Record<number, string> = {
      1: '#8BD47D',
      2: '#65C049',
      3: '#00A1D6',
      4: '#FB7299',
      5: '#E66C5A',
      6: '#FFD700',
    }
    return colors[level] || '#9499A0'
  }, [user?.level])

  return { getLevelColor }
}

/**
 * Hook for route guard
 */
export function useRouteGuard(requireAuth: boolean = true) {
  const navigate = useNavigate()
  const isAuthenticated = useIsAuthenticated()
  const isLoading = useAuthStore((state) => state.isLoading)

  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    }
  }, [isLoading, isAuthenticated, requireAuth, navigate])

  return { isReady: !isLoading, isAuthenticated }
}
