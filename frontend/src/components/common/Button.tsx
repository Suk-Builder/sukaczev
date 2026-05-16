import { forwardRef } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-bili-pink/30'

    const variants = {
      primary: 'bg-bili-pink text-white hover:bg-bili-pink-dark active:bg-bili-pink shadow-sm disabled:opacity-50 disabled:cursor-not-allowed',
      secondary: 'bg-bili-bg text-bili-text-primary hover:bg-bili-border-light active:bg-bili-border disabled:opacity-50 disabled:cursor-not-allowed',
      outline: 'border-2 border-bili-border text-bili-text-primary hover:border-bili-pink hover:text-bili-pink active:bg-bili-pink-light disabled:opacity-50 disabled:cursor-not-allowed',
      ghost: 'text-bili-text-secondary hover:bg-bili-bg hover:text-bili-text-primary active:bg-bili-border disabled:opacity-50 disabled:cursor-not-allowed',
      danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-8 py-3 text-base',
    }

    const widthClass = fullWidth ? 'w-full' : ''
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'

/**
 * Icon button - circular button with only icon
 */
export function IconButton({
  icon,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...props
}: {
  icon: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }

  const variants = {
    primary: 'bg-bili-pink text-white hover:bg-bili-pink-dark',
    secondary: 'bg-bili-bg text-bili-text-primary hover:bg-bili-border-light',
    ghost: 'text-bili-text-tertiary hover:bg-bili-bg hover:text-bili-text-primary',
    danger: 'text-red-500 hover:bg-red-50',
  }

  return (
    <button
      className={`inline-flex items-center justify-center rounded-full transition-colors ${sizeClasses[size]} ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {icon}
    </button>
  )
}

/**
 * Action button group
 */
export function ButtonGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex rounded-lg overflow-hidden border border-bili-border ${className}`}>
      {children}
    </div>
  )
}

export function ButtonGroupItem({
  active = false,
  children,
  onClick,
  className = '',
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-white text-bili-text-primary shadow-sm'
          : 'bg-bili-bg text-bili-text-tertiary hover:text-bili-text-primary'
      } ${className}`}
    >
      {children}
    </button>
  )
}
