// Ancho de trabajo del panel. Vive fuera de las acciones porque un archivo
// 'use server' solo puede exportar funciones async.
export const ANCHOS = ['compacto', 'ancho', 'completo'] as const;
export type Ancho = (typeof ANCHOS)[number];
export const ANCHO_POR_DEFECTO: Ancho = 'ancho';
