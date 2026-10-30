import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { sesionActual } from '@/lib/sesion'
import type { SesionActiva } from '@/modules/acceso/repository/acceso.repository'

/**
 * La sesión de quien usa la pantalla o la acción. Sin sesión, a la pantalla de entrada; con una
 * contraseña provisoria, a elegir la suya; si falta el código del celular, a escribirlo (o a
 * configurarlo la primera vez) antes de seguir (docs/decisiones/0013).
 */
export const exigirSesion = cache(async (): Promise<SesionActiva> => {
  const sesion = await sesionActual()
  if (!sesion) redirect('/entrar')
  if (sesion.contrasenaProvisoria) redirect('/entrar/nueva-contrasena')
  if (sesion.faltaCodigo)
    redirect(sesion.codigoConfigurado ? '/entrar/codigo' : '/entrar/configurar-codigo')
  return sesion
})

/** El estudio de la sesión: una cuenta es de un solo estudio. */
export const getCurrentEstudioId = cache(async (): Promise<string> => {
  return (await exigirSesion()).estudioId
})

export const getCurrentEstudio = cache(async () => {
  const id = await getCurrentEstudioId()
  return db.estudio.findUniqueOrThrow({ where: { id } })
})
