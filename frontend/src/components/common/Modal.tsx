import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  footer?: React.ReactNode
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  footer,
}: ModalProps) {
  // Escape key handler
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeOnEscape, isOpen, onClose])

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose()
      }
    },
    [closeOnOverlayClick, onClose]
  )

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} animate-slide-up overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-bili-border-light">
            {title && <h3 className="text-base font-bold text-bili-text-primary">{title}</h3>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-bili-text-tertiary hover:bg-bili-bg hover:text-bili-text-primary transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-bili-border-light bg-bili-bg/50">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  )
}

/**
 * Confirm dialog
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '确认',
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'warning',
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'info'
}) {
  const typeConfig = {
    warning: { icon: 'text-yellow-500', bg: 'bg-yellow-50' },
    danger: { icon: 'text-red-500', bg: 'bg-red-50' },
    info: { icon: 'text-blue-500', bg: 'bg-blue-50' },
  }

  const config = typeConfig[type]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={false}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-bili-text-secondary bg-white border border-bili-border rounded-lg hover:bg-bili-bg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              type === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : type === 'warning'
                ? 'bg-yellow-500 hover:bg-yellow-600'
                : 'bg-bili-blue hover:bg-bili-blue'
            }`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 ${config.bg} rounded-full flex items-center justify-center`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={config.icon}>
            {type === 'danger' ? (
              <>
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v5M10 13h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            ) : type === 'warning' ? (
              <>
                <path d="M10 2L2 16h16L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M10 7v4M10 13h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-bili-text-primary">{title}</h4>
          <p className="mt-1 text-sm text-bili-text-secondary">{message}</p>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Drawer component (slide from side)
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  placement = 'right',
  size = 'md',
}: {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  placement?: 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const sizeClasses = {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[32rem]',
  }

  const placementClasses = {
    left: `left-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`,
    right: `right-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`,
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute top-0 bottom-0 ${sizeClasses[size]} ${placementClasses[placement]} bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-bili-border-light flex-shrink-0">
            <h3 className="text-base font-bold text-bili-text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-bili-text-tertiary hover:bg-bili-bg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
