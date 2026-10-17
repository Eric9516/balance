import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
          'focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
