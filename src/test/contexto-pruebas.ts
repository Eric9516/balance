/**
 * setupFiles de las pruebas de integración y de la auditoría (sin un pedido de Next ni cookies):
 *
 * - Cada archivo prepara sus datos sin las reglas de los estudios (crea sus propios estudios). La
 *   prueba de espionaje declara cada estudio a mano con conEstudio (src/lib/contexto-base.ts).
 * - Las acciones de la app trabajan como el dueño del estudio activo más antiguo, como antes del
 *   login. El login de verdad lo prueban acceso.itest.ts y la auditoría, en un navegador.
 */
import { comoPlataforma, plataformaPorDefectoEnPruebas } from '@/lib/contexto-base'
import { db } from '@/lib/db'
import { sesionDePruebas } from '@/lib/sesion'

plataformaPorDefectoEnPruebas()

sesionDePruebas(async () => {
  const estudio = await comoPlataforma(() =>
    db.estudio.findFirst({
      where: { activo: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
  )
  return estudio
    ? {
        usuarioId: '00000000-0000-7000-8000-000000000000',
        estudioId: estudio.id,
        rol: 'DUENO',
        contrasenaProvisoria: false,
      }
    : null
})
