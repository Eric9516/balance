import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        activo: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        inactivo: 'bg-slate-100 text-slate-500 ring-slate-200',
        borrador: 'bg-amber-50 text-amber-700 ring-amber-200',
        proceso: 'bg-blue-50 text-blue-700 ring-blue-200',
        revision: 'bg-violet-50 text-violet-700 ring-violet-200',
        cerrado: 'bg-slate-100 text-slate-500 ring-slate-200',
        error: 'bg-red-50 text-red-700 ring-red-200',
        defecto: 'bg-blue-50 text-blue-700 ring-blue-200',
      },
    },
    defaultVariants: { variant: 'activo' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
