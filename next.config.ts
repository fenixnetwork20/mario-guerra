import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vacío = dominio propio en la raíz. Se fija con NEXT_PUBLIC_BASE_PATH al construir.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
