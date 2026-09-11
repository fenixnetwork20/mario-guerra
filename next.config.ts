import type { NextConfig } from 'next';

const nextConfig: NextConfig = {

  // Vacío = dominio propio en la raíz. Se fija con NEXT_PUBLIC_BASE_PATH al construir.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Dos núcleos. Lo que evita colgar el VPS es el `nice` del
    // script de build en package.json, no el número de núcleos.
    cpus: 2,
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
