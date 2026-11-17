import type { NextConfig } from 'next';

const nextConfig: NextConfig = {

  // Vacío = dominio propio en la raíz. Se fija con NEXT_PUBLIC_BASE_PATH al construir.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // Para probar un build sin pisar el que está sirviendo producción.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Dos núcleos. Lo que evita colgar el VPS es el `nice` del
    // script de build en package.json, no el número de núcleos.
    cpus: 2,
    // 17 MB: el video de precios puede pesar hasta 16 MB, el tope de WhatsApp.
    serverActions: { bodySizeLimit: '17mb' },
  },
};

export default nextConfig;
