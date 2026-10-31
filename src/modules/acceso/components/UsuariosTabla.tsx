'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { KeyRound, MoreHorizontal, Smartphone, Trash2, UserCheck, UserX } from 'lucide-react'
import type { RolUsuario } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { formatFechaYHora } from '@/lib/utils/dates'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import type { ActionResult } from '@/modules/errores/types'
import { NOMBRE_DEL_ROL, QUE_HACE_EL_ROL } from '../domain/permisos'
import type { UsuarioDelEstudio } from '../services/usuarios.service'
import {
  activarUsuarioAction,
  cambiarRolAction,
  eliminarUsuarioAction,
  nuevaContrasenaAction,
  quitarCodigoAction,
} from '../actions/usuarios.actions'
import { ContrasenaParaPasar, type ParaPasar } from './ContrasenaParaPasar'

const ROLES: RolUsuario[] = ['DUENO', 'CONTADOR', 'ASISTENTE']

type Pedido =
  | { tipo: 'rol'; usuario: UsuarioDelEstudio; rol: RolUsuario }
  | { tipo: 'desactivar' | 'eliminar' | 'contrasena' | 'codigo'; usuario: UsuarioDelEstudio }

/** Qué dice la ventana de confirmar cada cambio. */
function textoDe(p: Pedido) {
  const n = p.usuario.nombre
  switch (p.tipo) {
    case 'rol':
      return {
        title: `Cambiar el rol de ${n}`,
        description: `Pasa de ${NOMBRE_DEL_ROL[p.usuario.rol].toLowerCase()} a ${NOMBRE_DEL_ROL[p.rol].toLowerCase()}. ${QUE_HACE_EL_ROL[p.rol]}`,
        confirmLabel: 'Cambiar el rol',
        variant: 'default' as const,
      }
    case 'desactivar':
      return {
        title: `Desactivar a ${n}`,
        description:
          'No va a poder entrar, y si tiene la app abierta, se le cierra al instante. Lo que cargó queda igual. Podés reactivar su cuenta cuando quieras.',
        confirmLabel: 'Desactivar',
        variant: 'destructive' as const,
      }
    case 'eliminar':
      return {
        title: `Eliminar a ${n}`,
        description: 'Se borra su cuenta. Lo que cargó en los balances queda igual.',
        warning: 'Si solo querés que no entre por un tiempo, mejor desactivá su cuenta.',
        confirmLabel: 'Eliminar',
        variant: 'destructive' as const,
      }
    case 'contrasena':
      return {
        title: `Contraseña provisoria para ${n}`,
        description:
          'Para quien se olvidó la suya. Se le crea una contraseña provisoria y se le cierran las sesiones abiertas. La vas a ver una sola vez para pasársela; al entrar la cambia por una suya.',
        confirmLabel: 'Crear contraseña',
        variant: 'default' as const,
      }
    case 'codigo':
      return {
        title: `Quitar el código del celular de ${n}`,
        description:
          'Para quien cambió o perdió el celular. Se le cierran las sesiones abiertas y, la próxima vez que entre, configura el código de nuevo.',
        confirmLabel: 'Quitar el código',
        variant: 'destructive' as const,
      }
  }
}

function MenuDeLaPersona({
  usuario,
  onPedir,
  onReactivar,
}: {
  usuario: UsuarioDelEstudio
  onPedir: (p: Pedido) => void
  onReactivar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  function alternar() {
    if (!abierto && boton.current) {
      const r = boton.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setAbierto((v) => !v)
  }

  const item =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed'
  const pedir = (p: Pedido) => () => {
    setAbierto(false)
    onPedir(p)
  }

  return (
    <>
      <button
        ref={boton}
        onClick={alternar}
        aria-label={`Opciones de ${usuario.nombre}`}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div
            className="fixed z-50 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-md"
            style={{ top: pos.top, right: pos.right }}
          >
            <button
              className={`${item} text-slate-700 hover:bg-slate-50`}
              onClick={pedir({ tipo: 'contrasena', usuario })}
            >
              <KeyRound className="h-3.5 w-3.5 text-slate-400" />
              Contraseña provisoria nueva
            </button>
            {usuario.codigoActivado && (
              <button
                className={`${item} text-slate-700 hover:bg-slate-50`}
                onClick={pedir({ tipo: 'codigo', usuario })}
              >
                <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                Quitar el código del celular
              </button>
            )}
            <div className="my-1 h-px bg-slate-100" />
            {usuario.activo ? (
              <button
                className={`${item} text-red-600 hover:bg-red-50`}
                onClick={pedir({ tipo: 'desactivar', usuario })}
              >
                <UserX className="h-3.5 w-3.5" />
                Desactivar
              </button>
            ) : (
              <button
                className={`${item} text-slate-700 hover:bg-slate-50`}
                onClick={() => {
                  setAbierto(false)
                  onReactivar()
                }}
              >
                <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                Reactivar
              </button>
            )}
            {usuario.rol === 'DUENO' ? (
              <p className="flex items-start gap-2 px-3 py-2 text-xs leading-relaxed text-slate-400">
                <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Para eliminar a un dueño, primero cambiale el rol.
              </p>
            ) : (
              <button
                className={`${item} text-red-600 hover:bg-red-50`}
                onClick={pedir({ tipo: 'eliminar', usuario })}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

/** La gente del estudio: el dueño cambia roles, desactiva, elimina y da contraseñas provisorias. */
export function UsuariosTabla({ usuarios }: { usuarios: UsuarioDelEstudio[] }) {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [paraPasar, setParaPasar] = useState<ParaPasar | null>(null)
  const [enviando, startTransition] = useTransition()

  function ejecutar<T>(accion: () => Promise<ActionResult<T>>, onOk: (data: T) => void) {
    startTransition(async () => {
      const r = await accion()
      setPedido(null)
      if (r.ok) onOk(r.data)
      else toastError(r.error)
    })
  }

  function confirmar() {
    if (!pedido) return
    const { usuario } = pedido
    switch (pedido.tipo) {
      case 'rol':
        return ejecutar(
          () => cambiarRolAction(usuario.id, pedido.rol),
          () =>
            toastSuccess(`${usuario.nombre} ahora es ${NOMBRE_DEL_ROL[pedido.rol].toLowerCase()}`),
        )
      case 'desactivar':
        return ejecutar(
          () => activarUsuarioAction(usuario.id, false),
          () => toastSuccess(`Se desactivó la cuenta de ${usuario.nombre}`),
        )
      case 'eliminar':
        return ejecutar(
          () => eliminarUsuarioAction(usuario.id),
          () => toastSuccess(`Se eliminó la cuenta de ${usuario.nombre}`),
        )
      case 'contrasena':
        return ejecutar(
          () => nuevaContrasenaAction(usuario.id),
          ({ contrasena }) =>
            setParaPasar({
              nombre: usuario.nombre,
              email: usuario.email,
              contrasena,
              nueva: false,
            }),
        )
      case 'codigo':
        return ejecutar(
          () => quitarCodigoAction(usuario.id),
          () => toastSuccess(`Se quitó el código del celular de ${usuario.nombre}`),
        )
    }
  }

  function reactivar(usuario: UsuarioDelEstudio) {
    ejecutar(
      () => activarUsuarioAction(usuario.id, true),
      () => toastSuccess(`${usuario.nombre} puede volver a entrar`),
    )
  }

  const th = 'px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase'
  const texto = pedido ? textoDe(pedido) : null

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-encabezado">
              <th className={th}>Persona</th>
              <th className={th}>Rol</th>
              <th className={th}>Estado</th>
              <th className={th}>Último ingreso</th>
              <th className="px-4 py-3">
                <span className="sr-only">Opciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-slate-100 transition-colors last:border-0 ${
                  u.activo ? 'hover:bg-acento-suave' : 'bg-slate-50/60'
                }`}
              >
                <td className={`px-4 py-3 ${u.activo ? '' : 'opacity-60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{u.nombre}</span>
                    {u.esVos && <Badge variant="defecto">Vos</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  {u.esVos ? (
                    <span className="text-slate-700">{NOMBRE_DEL_ROL[u.rol]}</span>
                  ) : (
                    <Select
                      aria-label={`Rol de ${u.nombre}`}
                      value={u.rol}
                      disabled={enviando}
                      onChange={(e) =>
                        setPedido({ tipo: 'rol', usuario: u, rol: e.target.value as RolUsuario })
                      }
                      className="h-8 w-36 py-0"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {NOMBRE_DEL_ROL[r]}
                        </option>
                      ))}
                    </Select>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={u.activo ? 'activo' : 'inactivo'}>
                      {u.activo ? 'Activa' : 'Desactivada'}
                    </Badge>
                    {u.activo && u.contrasenaProvisoria && (
                      <Badge variant="borrador">Con contraseña provisoria</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {u.ultimoIngreso ? (
                    formatFechaYHora(u.ultimoIngreso)
                  ) : (
                    <span className="text-slate-400">Todavía no entró</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.esVos ? (
                    <Link
                      href="/mi-cuenta"
                      className="text-xs font-medium text-blue-700 underline-offset-4 hover:underline"
                    >
                      Mi cuenta
                    </Link>
                  ) : (
                    <MenuDeLaPersona
                      usuario={u}
                      onPedir={setPedido}
                      onReactivar={() => reactivar(u)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={Boolean(pedido)}
        onClose={() => !enviando && setPedido(null)}
        onConfirm={confirmar}
        title={texto?.title ?? ''}
        description={texto?.description ?? ''}
        warning={texto && 'warning' in texto ? texto.warning : undefined}
        confirmLabel={texto?.confirmLabel}
        variant={texto?.variant}
        isPending={enviando}
      />
      <ContrasenaParaPasar datos={paraPasar} onClose={() => setParaPasar(null)} />
    </>
  )
}
