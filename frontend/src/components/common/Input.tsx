import { forwardRef, useState } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, fullWidth = false, className = '', ...props }, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-bili-text-primary mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div
          className={`relative flex items-center border rounded-lg transition-all duration-200 bg-white ${
            error
              ? 'border-red-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100'
              : focused
              ? 'border-bili-pink ring-2 ring-bili-pink/10'
              : 'border-bili-border hover:border-bili-text-tertiary'
          }`}
        >
          {leftIcon && (
            <span className="pl-3 text-bili-text-tertiary flex-shrink-0">{leftIcon}</span>
          )}
          <input
            ref={ref}
            className={`flex-1 bg-transparent px-3 py-2.5 text-sm text-bili-text-primary placeholder-bili-text-tertiary outline-none ${
              leftIcon ? 'pl-2' : ''
            } ${rightIcon ? 'pr-2' : ''}`}
            onFocus={(e) => {
              setFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              props.onBlur?.(e)
            }}
            {...props}
          />
          {rightIcon && (
            <span className="pr-3 text-bili-text-tertiary flex-shrink-0">{rightIcon}</span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-bili-text-tertiary">{helperText}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

/**
 * Textarea component
 */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string
    error?: string
    helperText?: string
    fullWidth?: boolean
  }
>(({ label, error, helperText, fullWidth = false, className = '', ...props }, ref) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-bili-text-primary mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={`w-full px-4 py-2.5 border rounded-lg text-sm text-bili-text-primary placeholder-bili-text-tertiary outline-none transition-all duration-200 resize-vertical min-h-[80px] bg-white ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : focused
            ? 'border-bili-pink ring-2 ring-bili-pink/10'
            : 'border-bili-border hover:border-bili-text-tertiary'
        }`}
        onFocus={(e) => {
          setFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          props.onBlur?.(e)
        }}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-bili-text-tertiary">{helperText}</p>}
    </div>
  )
})

Textarea.displayName = 'Textarea'

/**
 * Select component
 */
export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string
    error?: string
    options: { value: string; label: string }[]
    fullWidth?: boolean
  }
>(({ label, error, options, fullWidth = false, className = '', ...props }, ref) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-bili-text-primary mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={`w-full appearance-none px-4 py-2.5 border rounded-lg text-sm text-bili-text-primary bg-white outline-none transition-all duration-200 focus:border-bili-pink focus:ring-2 focus:ring-bili-pink/10 ${
            error ? 'border-red-300' : 'border-bili-border hover:border-bili-text-tertiary'
          }`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="#9499A0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
})

Select.displayName = 'Select'

/**
 * Checkbox component
 */
export function Checkbox({
  label,
  error,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          className="peer sr-only"
          {...props}
        />
        <div
          className={`w-4 h-4 border-2 rounded transition-all ${
            props.checked
              ? 'bg-bili-pink border-bili-pink'
              : 'border-bili-border bg-white hover:border-bili-text-tertiary'
          } ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {props.checked && (
            <svg className="w-full h-full text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6l2.5 2.5 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
      {label && <span className="text-sm text-bili-text-secondary">{label}</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  )
}

/**
 * Search input with icon
 */
export function SearchInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { fullWidth?: boolean }) {
  return (
    <Input
      leftIcon={
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M7.333 12.667A5.333 5.333 0 107.333 2a5.333 5.333 0 000 10.667zM14 14l-2.9-2.9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
      placeholder="搜索..."
      className={className}
      {...props}
    />
  )
}
