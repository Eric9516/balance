import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Utilidades propias del sistema visual (globals.css). Sin registrarlas,
// tailwind-merge toma `text-tabla` como color y la descarta frente a `text-slate-*`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['tabla', 'tabla-sm'] }],
      'text-color': [{ text: ['tinta', 'tinta-suave', 'acento', 'positivo', 'negativo'] }],
      'bg-color': [{ bg: ['papel', 'superficie', 'acento', 'acento-suave'] }],
      'border-color': [{ border: ['linea'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
