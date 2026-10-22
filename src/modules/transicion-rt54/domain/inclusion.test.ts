import { describe, expect, it } from 'vitest'
import { CLAVE_NOTA_TRANSICION, inclusionNotaTransicion } from './inclusion'

const con = (estado: 'SUGERIDO' | 'ACEPTADO' | 'DESCARTADO' | 'NO_APLICA') => [
  { clave: 'ANEXO_BIENES_USO', estado: 'ACEPTADO' as const },
  { clave: CLAVE_NOTA_TRANSICION, estado },
]

describe('inclusionNotaTransicion', () => {
  it('fuera de la primera aplicación de la RT 54 no hay nota, decida lo que decida el contador', () => {
    expect(inclusionNotaTransicion(false, con('ACEPTADO'))).toEqual({
      incluir: false,
      motivo: 'NO_ES_PRIMERA_ADOPCION',
    })
  })

  it('incluida en la configuración de anexos: aparece', () => {
    expect(inclusionNotaTransicion(true, con('ACEPTADO'))).toEqual({ incluir: true })
  })

  it('como los anexos: sugerida, quitada, descartada o "no aplica" no aparece y avisa que la norma la exige', () => {
    // "Quitar de los estados" borra la decisión: la nota vuelve a sugerida.
    for (const docs of [con('SUGERIDO'), con('DESCARTADO'), con('NO_APLICA'), []]) {
      const r = inclusionNotaTransicion(true, docs)
      expect(r).toMatchObject({ incluir: false, motivo: 'NO_INCLUIDA' })
      expect(r.incluir === false && r.motivo === 'NO_INCLUIDA' && r.advertencia).toContain(
        'la norma exige esa nota',
      )
    }
  })
})
