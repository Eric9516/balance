import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-9 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-slate-200',
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'
