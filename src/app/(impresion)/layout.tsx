import '@/modules/exportacion/components/documento.css'

/** Rutas de impresión: sin menú lateral, fondo papel en pantalla y blanco al imprimir. */
export default function ImpresionLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-papel">{children}</div>
}
