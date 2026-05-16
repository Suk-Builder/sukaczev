import { useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/common/Input'
import { Checkbox } from '@/components/common/Input'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, isLoading, error, clearError } = useAuth()

  const [form, setForm] = useState({
    username: '',
    password: '',
    remember: true,
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const handleChange = useCallback((field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (error) clearError()
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }, [error, clearError, formErrors])

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.username.trim()) {
      errors.username = '请输入用户名'
    } else if (form.username.length < 3) {
      errors.username = '用户名至少3个字符'
    }
    if (!form.password) {
      errors.password = '请输入密码'
    } else if (form.password.length < 6) {
      errors.password = '密码至少6个字符'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      try {
        await login({
          username: form.username,
          password: form.password,
          remember: form.remember,
        })
        const redirect = searchParams.get('redirect')
        navigate(redirect || '/')
      } catch {
        // Error handled by auth store
      }
    },
    [form, login, navigate, searchParams]
  )

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#FB7299" />
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="text-2xl font-bold text-bili-text-primary">Sukačev</span>
          </Link>
          <p className="mt-2 text-sm text-bili-text-tertiary">登录以享受完整功能</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-card p-8">
          <h2 className="text-lg font-bold text-bili-text-primary text-center mb-6">账号登录</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="用户名/邮箱"
              placeholder="请输入用户名或邮箱"
              value={form.username}
              onChange={(e) => handleChange('username', e.target.value)}
              error={formErrors.username}
              fullWidth
              leftIcon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0H2z" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              }
            />

            <Input
              type="password"
              label="密码"
              placeholder="请输入密码"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              error={formErrors.password}
              fullWidth
              leftIcon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="7" width="12" height="7" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="8" cy="10.5" r="1" fill="currentColor" />
                </svg>
              }
            />

            <div className="flex items-center justify-between">
              <Checkbox
                label="记住我"
                checked={form.remember}
                onChange={(e) => handleChange('remember', e.target.checked)}
              />
              <Link to="/forgot-password" className="text-xs text-bili-pink hover:underline">
                忘记密码？
              </Link>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-bili-pink text-white text-sm font-medium rounded-lg hover:bg-bili-pink-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-bili-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-bili-text-tertiary">其他登录方式</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="flex items-center justify-center gap-4">
            <button className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center hover:bg-green-100 transition-colors" title="微信登录">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.5 1C5 1 1 4 1 8c0 2.5 1.5 4.5 3.5 6L4 17l3.5-1.5c.5.1 1 .1 1.5.1 4.5 0 8.5-3 8.5-7.5S14 1 9.5 1zM6 7.5a1 1 0 110-2 1 1 0 010 2zm5 0a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            <button className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors" title="QQ登录">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 1C5 1 2 4 2 7c0 1.5.5 3 2 4-.5 2-1.5 4-1 4.5.5.5 2.5-1 4-2 .5.1 1 .1 1.5.1 4.5 0 8.5-3 8.5-7.5S15 1 10 1z" />
              </svg>
            </button>
            <button className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors" title="微博登录">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.5 5c1.5 0 2.5 1 2.5 2.5S15 12 13.5 12c-1.5 0-3-.5-3-2s1.5-3 3-3zM7 8c1 0 2 .5 2 1.5S8 11 7 11s-2.5-.5-2.5-1.5S6 8 7 8z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-bili-text-tertiary">
          还没有账号？
          <Link to="/register" className="text-bili-pink hover:underline font-medium ml-1">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}
