// Prefijo bajo el que se sirve la app. Vacío = dominio propio en la raíz
// (drmarioguerra.com); '/marioguerra' = subcarpeta de fenixflowai.com.
// Se fija al construir con NEXT_PUBLIC_BASE_PATH y se usa en TODA ruta escrita
// a mano: next/link y el router aplican el basePath solos, pero fetch(), las
// imágenes y los enlaces sueltos no.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Ruta absoluta dentro de la app: ruta('/marca/logo.png'). */
export const ruta = (p: string) => `${BASE_PATH}${p}`;

/** Igual que ruta(), con nombre propio para las llamadas a la API. */
export const api = (p: string) => `${BASE_PATH}${p}`;
