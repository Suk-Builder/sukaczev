import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Input, Select } from '@/components/common/Input'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuth()

  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    email: '',
    phone: '',
    gender: 'secret' as 'male' | 'female' | 'secret',
    birthday: '',
    agreement: false,
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
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      errors.username = '用户名只能包含字母、数字和下划线'
    }

    if (!form.nickname.trim()) {
      errors.nickname = '请输入昵称'
    } else if (form.nickname.length < 2 || form.nickname.length > 20) {
      errors.nickname = '昵称长度为2-20个字符'
    }

    if (!form.password) {
      errors.password = '请输入密码'
    } else if (form.password.length < 6) {
      errors.password = '密码至少6个字符'
    } else if (form.password.length > 32) {
      errors.password = '密码最多32个字符'
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(form.password)) {
      errors.password = '密码需包含字母和数字'
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致'
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = '邮箱格式不正确'
    }

    if (!form.agreement) {
      errors.agreement = '请同意用户协议和隐私政策'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      try {
        await register({
          username: form.username,
          password: form.password,
          confirmPassword: form.confirmPassword,
          nickname: form.nickname,
          email: form.email || undefined,
          phone: form.phone || undefined,
          gender: form.gender,
          birthday: form.birthday || undefined,
          agreement: form.agreement,
        })
        navigate('/')
      } catch {
        // Error handled by auth store
      }
    },
    [form, register, navigate]
  )

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8">
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
          <p className="mt-2 text-sm text-bili-text-tertiary">创建你的账号</p>
        </div>

        {/* Register Form */}
        <div className="bg-white rounded-2xl shadow-card p-8">
          <h2 className="text-lg font-bold text-bili-text-primary text-center mb-6">注册账号</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <Input
              label="用户名"
              placeholder="3-20位字母、数字或下划线"
              value={form.username}
              onChange={(e) => handleChange('username', e.target.value)}
              error={formErrors.username}
              fullWidth
              required
              leftIcon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0H2z" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              }
            />

            {/* Nickname */}
            <Input
              label="昵称"
              placeholder="显示名称，2-20个字符"
              value={form.nickname}
              onChange={(e) => handleChange('nickname', e.target.value)}
              error={formErrors.nickname}
              fullWidth
              required
            />

            {/* Password */}
            <Input
              type="password"
              label="密码"
              placeholder="至少6位，包含字母和数字"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              error={formErrors.password}
              fullWidth
              required
              leftIcon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="7" width="12" height="7" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              }
            />

            {/* Confirm Password */}
            <Input
              type="password"
              label="确认密码"
              placeholder="再次输入密码"
              value={form.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              error={formErrors.confirmPassword}
              fullWidth
              required
            />

            {/* Email (Optional) */}
            <Input
              type="email"
              label="邮箱（可选）"
              placeholder="用于找回密码"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={formErrors.email}
              fullWidth
              leftIcon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1 4l7 5 7-5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              }
            />

            {/* Gender */}
            <Select
              label="性别（可选）"
              value={form.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              options={[
                { value: 'secret', label: '保密' },
                { value: 'male', label: '男' },
                { value: 'female', label: '女' },
              ]}
              fullWidth
            />

            {/* Birthday */}
            <div>
              <label className="block text-sm font-medium text-bili-text-primary mb-1.5">生日（可选）</label>
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => handleChange('birthday', e.target.value)}
                className="w-full px-4 py-2.5 border border-bili-border rounded-lg text-sm text-bili-text-primary outline-none focus:border-bili-pink focus:ring-2 focus:ring-bili-pink/10 transition-all"
              />
            </div>

            {/* Agreement */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agreement}
                  onChange={(e) => handleChange('agreement', e.target.checked)}
                  className="mt-0.5 accent-bili-pink"
                />
                <span className="text-xs text-bili-text-secondary leading-relaxed">
                  我已阅读并同意
                  <Link to="/terms" className="text-bili-pink hover:underline">用户协议</Link>
                  和
                  <Link to="/privacy" className="text-bili-pink hover:underline">隐私政策</Link>
                </span>
              </label>
              {formErrors.agreement && <p className="mt-1 text-xs text-red-500">{formErrors.agreement}</p>}
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
                  注册中...
                </>
              ) : (
                '注册'
              )}
            </button>
          </form>
        </div>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-bili-text-tertiary">
          已有账号？
          <Link to="/login" className="text-bili-pink hover:underline font-medium ml-1">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}
