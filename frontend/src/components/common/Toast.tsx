import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration: number
}

interface ToastItemProps {
  toast: ToastMessage
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onRemove(toast.id), 300)
    }, toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const icons = {
    success: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="#22C55E" strokeWidth="1.5" />
        <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    error: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="#EF4444" strokeWidth="1.5" />
        <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    warning: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2L2 15h14L9 2z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 7v3M9 12h.01" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    info: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="#3B82F6" strokeWidth="1.5" />
        <path d="M9 5v5M9 12h.01" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  }

  const bgColors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${bgColors[toast.type]} ${
        exiting ? 'toast-exit' : 'toast-enter'
      }`}
    >
      <span className="flex-shrink-0">{icons[toast.type]}</span>
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => {
          setExiting(true)
          setTimeout(() => onRemove(toast.id), 300)
        }}
        className="ml-2 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M4 4l6 6M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// Global toast state manager
let addToastCallback: ((toast: ToastMessage) => void) | null = null

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const idCounter = useRef(0)

  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${++idCounter.current}-${Date.now()}`
    const newToast: ToastMessage = { id, type, message, duration }
    setToasts((prev) => [...prev, newToast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback((message: string, duration?: number) => addToast('success', message, duration), [addToast])
  const error = useCallback((message: string, duration?: number) => addToast('error', message, duration), [addToast])
  const warning = useCallback((message: string, duration?: number) => addToast('warning', message, duration), [addToast])
  const info = useCallback((message: string, duration?: number) => addToast('info', message, duration), [addToast])

  // Register global callback
  useEffect(() => {
    addToastCallback = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast])
    }
    return () => {
      addToastCallback = null
    }
  }, [])

  return { toasts, addToast, removeToast, success, error, warning, info }
}

// Global toast functions (can be called outside React)
export function toast(type: ToastType, message: string, duration = 3000) {
  if (addToastCallback) {
    const id = `toast-global-${Date.now()}-${Math.random()}`
    addToastCallback({ id, type, message, duration })
  }
}

toast.success = (message: string, duration?: number) => toast('success', message, duration)
toast.error = (message: string, duration?: number) => toast('error', message, duration)
toast.warning = (message: string, duration?: number) => toast('warning', message, duration)
toast.info = (message: string, duration?: number) => toast('info', message, duration)

/**
 * Toast container component
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>,
    document.body
  )
}
