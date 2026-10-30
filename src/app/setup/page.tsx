import { redirect } from 'next/navigation'
import { Scale } from 'lucide-react'
import { EstudioForm } from '@/modules/estudios/components/EstudioForm'
import { hayEstudios } from '@/modules/estudios/repository/estudio.repository'

export const metadata = { title: 'Configurar estudio' }

export default async function SetupPage() {
  // Cualquier estudio, aunque esté inactivo o la app no lo vea: el alta inicial es una sola vez.
  if (await hayEstudios()) redirect('/sociedades')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-200">
          <Scale className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Bienvenido a BalanceRT</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Para comenzar, completá los datos de tu estudio contable.
        </p>
      </div>
      <EstudioForm redirectTo="/sociedades" />
    </div>
  )
}
