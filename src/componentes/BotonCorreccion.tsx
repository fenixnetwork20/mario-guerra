'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { FormAccion, Boton, type Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

/**
 * Botón fijo para pedir una corrección desde donde uno esté. Guarda la pantalla
 * en la que estaba: casi siempre el problema es de esa página, y preguntarlo
 * después por WhatsApp cuesta más que registrarlo aquí.
 */
export function BotonCorreccion({ enviar }: { enviar: Accion }) {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const pantalla = usePathname();

  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-5 right-5 z-40 btn bg-[var(--color-cobre)] text-white hover:bg-[var(--color-cobre-luz)] shadow-lg py-2.5 px-4"
      >
        Reportar algo
      </button>

      {abierto && montado && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(6,23,32,.55)] p-4"
             role="dialog" aria-modal="true" onClick={() => setAbierto(false)}>
          <div className="tarjeta w-full max-w-lg p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="titulo text-[18px]">¿Qué hay que corregir?</h3>
            <p className="text-[13.5px] text-[var(--color-tinta-2)] mt-1.5 leading-relaxed">
              Escríbelo como lo dirías. Si puedes, adjunta una captura: se entiende mucho mejor.
            </p>

            {/* La ventana se cierra sola, pero no de inmediato: hay que darle
                tiempo a leer que quedó anotado. */}
            <FormAccion accion={enviar} onOk={() => setTimeout(() => setAbierto(false), 2400)} className="mt-4">
              <input type="hidden" name="pantalla" value={pantalla} />
              <textarea
                name="texto"
                rows={4}
                className="campo"
                placeholder="El nombre del paciente sale cortado en la agenda…"
                autoFocus
              />
              <label className="block mt-3">
                <span className="text-[13px] font-medium">Captura o foto (opcional)</span>
                <input type="file" name="foto" accept="image/png,image/jpeg,image/webp"
                  className="campo mt-1 text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-acento)] file:px-3 file:py-1.5 file:text-white file:text-[12.5px]" />
              </label>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" className="btn btn-borde" onClick={() => setAbierto(false)}>
                  Cerrar
                </button>
                <Boton>Enviar</Boton>
              </div>
            </FormAccion>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
