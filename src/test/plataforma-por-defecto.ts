/**
 * setupFiles de las pruebas de integración y de la auditoría: cada archivo prepara sus datos sin
 * las reglas de los estudios (crea sus propios estudios). La prueba de espionaje declara cada
 * estudio a mano con conEstudio (ver src/lib/contexto-base.ts).
 */
import { plataformaPorDefectoEnPruebas } from '@/lib/contexto-base'

plataformaPorDefectoEnPruebas()
