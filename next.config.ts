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
}

export default nextConfig
