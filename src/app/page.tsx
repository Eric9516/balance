import { redirect } from 'next/navigation'
import { sesionActual } from '@/lib/sesion'

export default async function HomePage() {
  redirect((await sesionActual()) ? '/sociedades' : '/entrar')
}
