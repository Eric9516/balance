/**
 * Servicio: arma el contexto real de la Nota de Primera Aplicación RT 54 (PN y
 * resultado anterior desde los estados, ajustes cargados) y genera el borrador.
 */

import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { cargarEstadosConPN, type EstadosConPN } from '@/modules/estados/services/estados.service'
import { totalAnteriorFila, totalFila } from '@/modules/patrimonio-neto/domain/evolucion'
import { findAjustesByEjercicio } from '../repository/ajustes.repository'
import { generarNotaTransicionRT54, type NotaTransicionGenerada } from '../lib/generarNota'
import type { AjusteTransicionDTO } from '../domain/types'

export async function previsualizarNotaTransicion(
  ejercicio: EjercicioContableDTO,
  precargado?: { estados?: EstadosConPN; ajustes?: AjusteTransicionDTO[] },
): Promise<NotaTransicionGenerada> {
  const [sociedad, ajustes, anterior, estados] = await Promise.all([
    findSociedadById(ejercicio.sociedadId),
    precargado?.ajustes ?? findAjustesByEjercicio(ejercicio.id),
    ejercicio.ejercicioAnteriorId
      ? findEjercicioById(ejercicio.ejercicioAnteriorId)
      : Promise.resolve(null),
    precargado?.estados ??
      findCuentasByEjercicio(ejercicio.id).then((cuentas) =>
        cargarEstadosConPN(ejercicio, cuentas),
      ),
  ])
  const { pnData } = estados
  return generarNotaTransicionRT54({
    razonSocial: sociedad?.razonSocial ?? '',
    fechaInicio: ejercicio.fechaInicio,
    fechaCierre: ejercicio.fechaCierre,
    fechaCierreAnterior: anterior?.fechaCierre ?? null,
    categoriaEnte: ejercicio.categoriaEnte,
    pnAnteriorSegunNormasPrevias: pnData.totalAnterior,
    resultadoAnteriorSegunNormasPrevias: totalAnteriorFila(
      pnData.movimientos,
      'RESULTADO_EJERCICIO',
    ),
    ajustes,
    modificacionInicioEEPN: totalFila(pnData.movimientos, 'MODIFICACION_INICIO'),
  })
}
