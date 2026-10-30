import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESION } from '@/lib/cookie-sesion'

/**
 * Sin la cookie de la sesión, a la pantalla de entrada (y después, de vuelta adonde iba). Es solo
 * un primer filtro rápido: cada pantalla y cada acción revisan la sesión en la base
 * (exigirSesion, src/lib/estudio-context.ts) y, sin ella, la base no muestra nada.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(COOKIE_SESION)) return NextResponse.next()
  const entrar = new URL('/entrar', request.url)
  const destino = request.nextUrl.pathname + request.nextUrl.search
  if (destino !== '/') entrar.searchParams.set('volver', destino)
  return NextResponse.redirect(entrar)
}

export const config = {
  // Todo menos la pantalla de entrada y los archivos de Next (scripts, estilos, imágenes)
  matcher: [
    '/((?!entrar|_next/static|_next/image|favicon\.ico|.*\.(?:png|jpg|jpeg|svg|ico|webp)$).*)',
  ],
}
