'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

/** Contraseña con el botón para verla mientras se escribe. */
export function CampoContrasena({
  id,
  name,
  autoComplete,
  error,
  describedBy,
}: {
  id: string
  name: string
  autoComplete: 'current-password' | 'new-password'
  error?: boolean
  describedBy?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        maxLength={201}
        error={error}
        aria-invalid={error || undefined}
        aria-describedby={describedBy}
        className="h-11 pr-11 text-[15px]"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
