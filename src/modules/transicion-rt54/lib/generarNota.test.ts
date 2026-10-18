import { describe, it, expect } from 'vitest'
import type { AjusteTransicionDTO } from '../domain/types'
import { generarNotaTransicionRT54, type ContextoNotaTransicion } from './generarNota'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function ajuste(partial: Partial<AjusteTransicionDTO> & { id: string }): AjusteTransicionDTO {
  return {
    ejercicioId: 'e',
    orden: 0,
    tipo: 'AJUSTE_MEDICION',
    concepto: 'Ajuste',
    descripcion: null,
    componentePN: 'RDOS_NO_ASIGNADOS',
    importePN: 0,
    importeResultadoAnterior: 0,
    rubroOrigen: null,
    rubroDestino: null,
    importeReclasificado: 0,
    ...partial,
  }
}

function ctx(partial: Partial<ContextoNotaTransicion> = {}): ContextoNotaTransicion {
  return {
    razonSocial: 'Ejemplo S.A.',
    fechaInicio: d('2025-01-01'),
    fechaCierre: d('2025-12-31'),
    fechaCierreAnterior: d('2024-12-31'),
    categoriaEnte: 'PEQUENA',
    pnAnteriorSegunNormasPrevias: 10000,
    resultadoAnteriorSegunNormasPrevias: 1500,
    ajustes: [],
    modificacionInicioEEPN: null,
    ...partial,
  }
}

describe('generarNotaTransicionRT54', () => {
  it('sin ajustes: párrafo de "sin efectos" y conciliaciones base = total', () => {
    const n = generarNotaTransicionRT54(ctx())
    expect(n.parrafos[0]).toContain('Ejemplo S.A.')
    expect(n.parrafos[0]).toContain('31/12/2025')
    expect(n.parrafos[0]).toContain('31/12/2024')
    expect(n.parrafos[1]).toContain('Entidad pequeña')
    expect(n.parrafos[2]).toContain('no produjo efectos')
    expect(n.conciliacionPN).toHaveLength(2)
    expect(n.conciliacionPN[1]).toMatchObject({ importe: 10000, esTotal: true })
    expect(n.conciliacionResultado[1]).toMatchObject({ importe: 1500, esTotal: true })
    expect(n.reclasificaciones).toEqual([])
    expect(n.advertencias[0]).toMatch(/Borrador/)
  })

  it('con ajustes de medición: conciliación cuadra y texto cambia', () => {
    const n = generarNotaTransicionRT54(
      ctx({
        ajustes: [
          ajuste({ id: '1', concepto: 'Revalúo', importePN: 2500, importeResultadoAnterior: -300 }),
          ajuste({ id: '2', concepto: 'Previsión', componentePN: null, importePN: -500 }),
        ],
      }),
    )
    expect(n.parrafos[2]).toContain('conciliaciones siguientes')
    expect(n.conciliacionPN.map((f) => f.importe)).toEqual([10000, 2500, -500, 12000])
    expect(n.conciliacionPN[1]?.concepto).toBe('Revalúo (Resultados no asignados)')
    expect(n.conciliacionPN[2]?.concepto).toBe('Previsión')
    // resultado: solo entran los ajustes con efecto en resultado anterior
    expect(n.conciliacionResultado.map((f) => f.importe)).toEqual([1500, -300, 1200])
  })

  it('reclasificaciones: no afectan conciliaciones, sí aparecen en texto y lista', () => {
    const n = generarNotaTransicionRT54(
      ctx({
        ajustes: [
          ajuste({
            id: 'r',
            tipo: 'RECLASIFICACION',
            concepto: 'Apertura de créditos',
            componentePN: null,
            rubroOrigen: 'Créditos',
            rubroDestino: 'Créditos en especie',
            importeReclasificado: 800,
          }),
        ],
      }),
    )
    expect(n.conciliacionPN.map((f) => f.importe)).toEqual([10000, 10000])
    expect(n.reclasificaciones).toEqual([
      {
        concepto: 'Apertura de créditos',
        origen: 'Créditos',
        destino: 'Créditos en especie',
        importe: 800,
      },
    ])
    expect(n.parrafos.some((p) => p.includes('reclasificaciones de exposición'))).toBe(true)
  })

  it('advierte si los ajustes no coinciden con la modificación de inicio del EEPN', () => {
    const n = generarNotaTransicionRT54(
      ctx({ ajustes: [ajuste({ id: '1', importePN: 100 })], modificacionInicioEEPN: 80 }),
    )
    expect(n.advertencias.some((a) => a.includes('no coincide'))).toBe(true)
    const ok = generarNotaTransicionRT54(
      ctx({ ajustes: [ajuste({ id: '1', importePN: 100 })], modificacionInicioEEPN: 100 }),
    )
    expect(ok.advertencias.some((a) => a.includes('no coincide'))).toBe(false)
  })

  it('sin categoría del ente: placeholder y advertencia', () => {
    const n = generarNotaTransicionRT54(ctx({ categoriaEnte: null }))
    expect(n.parrafos[1]).toContain('[completar categoría')
    expect(n.advertencias.some((a) => a.includes('categoría'))).toBe(true)
  })

  it('sin fecha de cierre anterior usa la fecha de inicio como transición', () => {
    const n = generarNotaTransicionRT54(ctx({ fechaCierreAnterior: null }))
    expect(n.parrafos[0]).toContain('01/01/2025')
  })
})
