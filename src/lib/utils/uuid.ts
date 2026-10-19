/**
 * Identificadores: todas las tablas usan UUID (versión 7, generado por la base con uuidv7()).
 * Ver docs/decisiones/0008-claves-uuid-v7.md.
 *
 * Un texto que no es un UUID no puede ser un identificador de la base: consultarlo haría fallar a
 * PostgreSQL ("invalid input syntax for type uuid"). Las búsquedas por identificador que reciben
 * datos de afuera (la dirección de una página, un formulario) lo validan antes y responden
 * "no encontrado".
 */
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMATO_UUID.test(valor)
}
