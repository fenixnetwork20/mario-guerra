'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/rutas';

type Mensaje = { rol: 'usuario' | 'ayudante'; texto: string };

const SUGERENCIAS = [
  '¿Cómo bloqueo un día completo?',
  '¿Dónde veo si un paciente pagó?',
  '¿Cómo activo los avisos en mi teléfono?',
  '¿Qué pasa si un paciente no confirma?',
];

/**
 * El modelo escribe **así** por costumbre, y pedirle que no lo haga no alcanza.
 * En vez de pelear con eso, se dibuja: los asteriscos se convierten en negrita
 * de verdad en lugar de quedarse a la vista.
 */
function conNegritas(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith('**') && trozo.endsWith('**') && trozo.length > 4
      ? <strong key={i}>{trozo.slice(2, -2)}</strong>
      : <span key={i}>{trozo}</span>
  );
}

/** Ayudante del panel: explica cómo hacer las cosas, no las hace. */
export function AyudaPanel() {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMontado(true), []);
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, pensando]);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  async function preguntar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || pensando) return;
    const siguiente: Mensaje[] = [...mensajes, { rol: 'usuario', texto: limpia }];
    setMensajes(siguiente);
    setTexto('');
    setPensando(true);
    try {
      const r = await fetch(api('/api/panel/ayuda'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensajes: siguiente }),
      });
      const d = await r.json();
      setMensajes([...siguiente, { rol: 'ayudante', texto: d.texto ?? d.error ?? 'No pude responderte.' }]);
    } catch {
      setMensajes([...siguiente, { rol: 'ayudante', texto: 'Falló la conexión. Intenta de nuevo.' }]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-5 right-[11.5rem] z-40 btn bg-[var(--color-acento)] text-white hover:bg-[var(--color-tinta)] shadow-lg py-2.5 px-4"
      >
        ¿Cómo hago…?
      </button>

      {abierto && montado && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(6,23,32,.55)] p-0 sm:p-4"
             role="dialog" aria-modal="true" onClick={() => setAbierto(false)}>
          <div
            className="tarjeta w-full sm:max-w-lg h-[85vh] sm:h-[32rem] flex flex-col rounded-b-none sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--color-linea)]">
              <div>
                <h3 className="titulo text-[16px]">¿Cómo hago…?</h3>
                <p className="text-[12.5px] text-[var(--color-tinta-3)] mt-0.5">
                  Pregunta lo que sea del sistema y te explico dónde y cómo.
                </p>
              </div>
              <button type="button" onClick={() => setAbierto(false)}
                className="text-[13px] text-[var(--color-tinta-3)] hover:text-[var(--color-tinta)]">
                Cerrar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensajes.length === 0 && (
                <div className="space-y-2">
                  <p className="text-[13.5px] text-[var(--color-tinta-2)]">Por ejemplo:</p>
                  {SUGERENCIAS.map((s) => (
                    <button key={s} type="button" onClick={() => preguntar(s)}
                      className="block w-full text-left rounded-lg border border-[var(--color-linea)] px-3 py-2 text-[13.5px] hover:border-[var(--color-cobre-luz)] hover:bg-[var(--color-cobre-fondo)] transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {mensajes.map((m, i) => (
                <div key={i} className={m.rol === 'usuario' ? 'flex justify-end' : ''}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap ${
                    m.rol === 'usuario'
                      ? 'bg-[var(--color-acento)] text-white'
                      : 'bg-[var(--color-papel-2)] text-[var(--color-tinta)]'
                  }`}>
                    {conNegritas(m.texto)}
                  </div>
                </div>
              ))}

              {pensando && <p className="text-[13px] text-[var(--color-tinta-3)]">Buscando…</p>}
              <div ref={finRef} />
            </div>

            <form
              className="flex gap-2 p-3 border-t border-[var(--color-linea)]"
              onSubmit={(e) => { e.preventDefault(); preguntar(texto); }}
            >
              <input
                className="campo"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="¿Cómo cambio mi clave?"
                autoFocus
              />
              <button className="btn btn-principal px-5" disabled={pensando || !texto.trim()}>
                Preguntar
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
