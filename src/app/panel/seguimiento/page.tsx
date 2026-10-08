import { redirect } from 'next/navigation';

// La pantalla de Seguimiento se quitó el 2026-10-08: el re-contacto a mano
// nunca se usó (0 registros) y lo reemplaza el seguimiento automático de los
// 7 días después de la valoración. Las revisiones postoperatorias ya salen en
// Hoy y en Agenda. Quien tenga el enlace guardado cae en Hoy.
export default function Seguimiento() {
  redirect('/panel');
}
