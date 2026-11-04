import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // En el servidor propio (Dockerfile) la app corre sola, sin node_modules completo: solo lo que usa.
  // En desarrollo y en Vercel no cambia nada.
  ...(process.env.NEXT_SALIDA_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  // La versión publicada (la pone el armado de la caja). Si el navegador quedó con otra, Next recarga
  // la pantalla entera en vez de mezclar las dos.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID || undefined,
  // Desde el pase (2026-11-04) BalanceRT trabaja en el servidor propio y Supabase es solo respaldo:
  // cualquier dirección de Vercel lleva a la app nueva, para que nadie cargue datos en la vieja.
  // Temporal (307), no permanente: el navegador no lo guarda y se puede quitar sin dejar rastros.
  async redirects() {
    if (process.env.VERCEL !== '1') return []
    return [
      { source: '/:camino*', destination: 'https://balancert.com.ar/:camino*', permanent: false },
    ]
  },
}

export default nextConfig
