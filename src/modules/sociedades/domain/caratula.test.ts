import { describe, expect, it } from 'vitest'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { armarCaratula } from './caratula'
import type { SociedadDTO } from './types'

const sociedad: SociedadDTO = {
  id: 's1',
  estudioId: 'e1',
  razonSocial: 'La Esperanza S.A.S.',
  cuit: '30-12345678-9',
  tipoPersona: 'JURIDICA',
  tipoSocietario: 'S.A.S.',
  condicionFiscal: null,
  domicilioLegal: 'San Martín 123',
  localidad: 'Leones',
  provincia: 'Córdoba',
  codigoPostal: '2594',
  actividadPpal: 'Venta de cereales\nAcopio',
  actividadSecundaria: null,
  clasificacionRT54: null,
  categoriaEnte: 'PEQUENA',
  fechaInscripcion: new Date('2015-04-10T00:00:00.000Z'),
  matriculaPJ: '12345-A',
  plazoDuracion: new Date('2114-04-10T00:00:00.000Z'),
  composicionCapital: '100 acciones de $ 1.000',
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const ejercicio = {
  numeroEjercicio: 5,
  fechaInicio: new Date('2025-01-01T00:00:00.000Z'),
  fechaCierre: new Date('2025-12-31T00:00:00.000Z'),
} as EjercicioContableDTO

describe('armarCaratula', () => {
  it('arma domicilio, provincia, actividades y párrafo del ejercicio', () => {
    const c = armarCaratula(sociedad, ejercicio)
    expect(c.domicilio).toBe('San Martín 123 - Leones (CP 2594)')
    expect(c.provinciaLinea).toBe('Córdoba - Republica Argentina')
    expect(c.actividadesPrincipales).toEqual(['Venta de cereales', 'Acopio'])
    expect(c.parrafo).toBe(
      'Por el ejercicio económico N°5 iniciado el 01 de Enero de 2025, expresado en moneda homogénea (pesos) del 31 de Diciembre de 2025, fecha de cierre del mismo.-',
    )
    expect(c.inscripcion).toBe('10 de abril de 2015')
    expect(c.composicionCapital).toEqual(['100 acciones de $ 1.000'])
    expect(c.camposFaltantes).toEqual([])
  })

  it('lista los datos faltantes y no pide composición del capital fuera de una S.A.S.', () => {
    const c = armarCaratula(
      {
        ...sociedad,
        tipoSocietario: 'S.R.L.',
        domicilioLegal: null,
        actividadPpal: null,
        fechaInscripcion: null,
        matriculaPJ: null,
        plazoDuracion: null,
        composicionCapital: null,
      },
      { ...ejercicio, numeroEjercicio: null },
    )
    expect(c.composicionCapital).toBeNull()
    expect(c.camposFaltantes).toEqual([
      'domicilio legal',
      'actividad principal',
      'número de ejercicio',
      'fecha de inscripción',
      'matrícula PJ',
      'plazo de duración',
    ])
  })
})
