import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from '@/components/Layout/Header'
import { Sidebar } from '@/components/Layout/Sidebar'
import { Footer } from '@/components/Layout/Footer'
import { ToastContainer } from '@/components/common/Toast'
import { Home } from '@/pages/Home'
import { VideoPage } from '@/pages/VideoPage'
import { SpacePage } from '@/pages/SpacePage'
import { CategoryPage } from '@/pages/CategoryPage'
import { SearchPage } from '@/pages/SearchPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { UploadPage } from '@/pages/UploadPage'
import { useAuthStore } from '@/stores/authStore'
import { useEffect } from 'react'

/**
 * Route guard component for protected routes
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const token = localStorage.getItem('token')

  if (!isAuthenticated && !token) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />
  }

  return <>{children}</>
}

/**
 * Redirect authenticated users away from auth pages
 */
function AuthRedirect({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    const params = new URLSearchParams(window.location.search)
    const redirect = params.get('redirect')
    return <Navigate to={redirect || '/'} replace />
  }

  return <>{children}</>
}

/**
 * Main layout wrapper
 */
function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bili-bg">
      <Header />
      <div className="pt-16 lg:pt-16">
        <Sidebar />
        <main className="lg:ml-56 min-h-screen">
          <div className="bili-container py-6">
            {children}
          </div>
          <Footer />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

/**
 * Auth layout (no sidebar/footer)
 */
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bili-bg">
      <Header />
      <div className="pt-16">
        <main className="min-h-screen">
          <div className="bili-container py-8">
            {children}
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

export default function App() {
  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      // Validate token and set user state
      // This is handled by the auth store persistence
    }
  }, [])

  return (
    <Routes>
      {/* Main routes with sidebar */}
      <Route
        path="/"
        element={
          <MainLayout>
            <Home />
          </MainLayout>
        }
      />
      <Route
        path="/video/:id"
        element={
          <MainLayout>
            <VideoPage />
          </MainLayout>
        }
      />
      <Route
        path="/space/:uid"
        element={
          <MainLayout>
            <SpacePage />
          </MainLayout>
        }
      />
      <Route
        path="/category/:slug"
        element={
          <MainLayout>
            <CategoryPage />
          </MainLayout>
        }
      />
      <Route
        path="/search"
        element={
          <MainLayout>
            <SearchPage />
          </MainLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <MainLayout>
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/upload"
        element={
          <MainLayout>
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      {/* Auth routes (no sidebar, redirect if authenticated) */}
      <Route
        path="/login"
        element={
          <AuthLayout>
            <AuthRedirect>
              <LoginPage />
            </AuthRedirect>
          </AuthLayout>
        }
      />
      <Route
        path="/register"
        element={
          <AuthLayout>
            <AuthRedirect>
              <RegisterPage />
            </AuthRedirect>
          </AuthLayout>
        }
      />

      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

