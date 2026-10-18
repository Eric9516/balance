'use client'

import { createContext, useContext } from 'react'
import type { PreferenciasEstudio } from '@/modules/estudios/domain/preferencias'
import { PREFERENCIAS_DEFAULT } from '@/modules/estudios/domain/preferencias'

const PreferenciasContext = createContext<PreferenciasEstudio>(PREFERENCIAS_DEFAULT)

/** Preferencias de visualización del estudio (leídas de la base en el layout principal). */
export function PreferenciasProvider({
  value,
  children,
}: {
  value: PreferenciasEstudio
  children: React.ReactNode
}) {
  return <PreferenciasContext value={value}>{children}</PreferenciasContext>
}

export function usePreferencias(): PreferenciasEstudio {
  return useContext(PreferenciasContext)
}
