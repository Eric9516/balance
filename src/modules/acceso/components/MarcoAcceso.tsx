import { Scale } from 'lucide-react'

/**
 * Marco de las pantallas de acceso (entrar, contraseña nueva): la marca a la izquierda en la
 * computadora y arriba en el celular; el formulario sobre papel.
 */
export function MarcoAcceso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="hidden w-[42%] max-w-xl flex-col justify-between bg-slate-800 px-12 py-10 text-white md:flex">
        <Marca claro />
        <div className="space-y-5">
          <h2 className="font-serif text-[2rem] leading-tight font-semibold tracking-tight">
            Balances bajo RT 54,
            <br />
            de punta a punta.
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-slate-300">
            Del Excel al balance para firmar, con controles en cada paso.
          </p>
        </div>
        <p className="text-xs text-slate-400">Plataforma contable para estudios argentinos</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 md:hidden">
          <Marca />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}

function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600">
        <Scale className="h-[18px] w-[18px] text-white" />
      </div>
      <span
        className={`font-serif text-xl font-semibold tracking-tight ${claro ? 'text-white' : 'text-slate-900'}`}
      >
        Balance<span className={claro ? 'text-blue-300' : 'text-blue-600'}>RT</span>
      </span>
    </div>
  )
}
