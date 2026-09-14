import { db } from '@/lib/db';
import { exigirSesion } from '@/lib/auth';
import { api } from '@/lib/rutas';
import { Seccion, Vacio } from '@/componentes/ui';
import { FormAccion, Boton } from '@/componentes/FormAccion';
import { resolverCorreccion } from '@/acciones/correcciones';

export const dynamic = 'force-dynamic';

type Fila = {
  id: number; texto: string; archivo: string | null; pantalla: string | null;
  estado: string; created_at: string; autor: string | null;
};

export default async function Correcciones() {
  await exigirSesion();

  const filas = db.prepare(
    `SELECT c.*, u.nombre AS autor
       FROM correcciones c LEFT JOIN usuarios u ON u.id = c.autor_id
      ORDER BY (c.estado = 'resuelta'), c.id DESC`
  ).all() as Fila[];

  const abiertas = filas.filter((f) => f.estado === 'abierta');
  const resueltas = filas.filter((f) => f.estado === 'resuelta');

  return (
    <div className="space-y-6">
      <Seccion
        titulo={`Por corregir${abiertas.length ? ` (${abiertas.length})` : ''}`}
        descripcion="Lo que reportan el doctor y la recepción desde el botón de abajo a la derecha."
      >
        {abiertas.length === 0 && <Vacio>Nada pendiente.</Vacio>}
        <ul className="space-y-3">
          {abiertas.map((f) => <Tarjeta key={f.id} f={f} />)}
        </ul>
      </Seccion>

      {resueltas.length > 0 && (
        <Seccion titulo={`Resueltas (${resueltas.length})`}>
          <ul className="space-y-3 opacity-70">
            {resueltas.map((f) => <Tarjeta key={f.id} f={f} />)}
          </ul>
        </Seccion>
      )}
    </div>
  );
}

function Tarjeta({ f }: { f: Fila }) {
  const resuelta = f.estado === 'resuelta';
  return (
    <li id={`c${f.id}`} className="rounded-lg border border-[var(--color-linea)] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12.5px] text-[var(--color-tinta-3)]">
          {f.autor ?? 'Alguien'} · {f.created_at}
          {f.pantalla ? ` · ${f.pantalla}` : ''}
        </span>
        {resuelta && <span className="pill bg-[var(--color-acento-luz)] text-[var(--color-acento)]">Resuelta</span>}
      </div>

      <p className="text-[14.5px] whitespace-pre-wrap leading-relaxed">{f.texto}</p>

      {f.archivo && (
        <a href={api(`/api/correccion/${f.id}`)} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={api(`/api/correccion/${f.id}`)} alt="Captura adjunta"
            className="max-h-64 rounded-md border border-[var(--color-linea)] object-contain bg-[var(--color-papel)]" />
        </a>
      )}

      <FormAccion accion={resolverCorreccion} className="self-start">
        <input type="hidden" name="correccion_id" value={f.id} />
        <input type="hidden" name="abrir" value={resuelta ? '1' : '0'} />
        <Boton variante={resuelta ? 'borde' : 'principal'} className="py-1.5 px-4 text-[13px]">
          {resuelta ? 'Reabrir' : 'Marcar resuelta'}
        </Boton>
      </FormAccion>
    </li>
  );
}
