'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Abre el diálogo de impresión del navegador (imprimir o guardar como PDF). */
export function BotonImprimir() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      Imprimir / Guardar PDF
    </Button>
  )
}
