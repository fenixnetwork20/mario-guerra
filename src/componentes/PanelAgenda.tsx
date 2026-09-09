'use client';

import { useState } from 'react';
import { FormAccion, Boton } from '@/componentes/FormAccion';
import type { Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

export function PanelAgenda({
  fecha, duracionPorDefecto, procedimientos, agendar, bloquear,
}: {
  fecha: string;
  duracionPorDefecto: number;
  procedimientos: string[];
  agendar: Accion;
  bloquear: Accion;
}) {
  const [pestana, setPestana] = useState<'agendar' | 'bloquear'>('agendar');
  const [tipo, setTipo] = useState<'valoracion' | 'cirugia' | 'revision'>('valoracion');

  return (
    <div className="tarjeta">
      <div className="flex border-b border-[var(--color-linea)]">
        {(['agendar', 'bloquear'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`px-4 py-3 text-[13.5px] font-semibold border-b-2 -mb-px ${
              pestana === p
                ? 'border-[var(--color-acento)] text-[var(--color-acento)]'
                : 'border-transparent text-[var(--color-tinta-3)] hover:text-[var(--color-tinta-2)]'
            }`}
          >
            {p === 'agendar' ? 'Agendar cita' : 'Bloquear horas'}
          </button>
        ))}
      </div>

      <div className="p-5">
        {pestana === 'agendar' ? (
          <FormAccion accion={agendar} className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-[13px] font-medium">Tipo</span>
                <select
                  name="tipo" className="campo mt-1" value={tipo}
                  onChange={(e) => setTipo(e.target.value as typeof tipo)}
                >
                  <option value="valoracion">Valoración</option>
                  <option value="cirugia">Cirugía</option>
                  <option value="revision">Revisión</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">Fecha</span>
                <input name="fecha" type="date" defaultValue={fecha} className="campo mt-1" required />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">Hora</span>
                <input name="hora" type="time" step={300} className="campo mt-1" required />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-[13px] font-medium">Nombre y apellido</span>
                <input name="nombre" className="campo mt-1" required />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">Cédula</span>
                <input name="cedula" className="campo mt-1" placeholder="V12345678" required />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">WhatsApp</span>
                <input name="whatsapp" className="campo mt-1" placeholder="04121234567" required />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-[13px] font-medium">Duración (min)</span>
                <input name="duracion" type="number" min={15} step={15}
                  defaultValue={duracionPorDefecto} className="campo mt-1" />
              </label>
              {tipo === 'valoracion' && (
                <label className="block">
                  <span className="text-[13px] font-medium">Modalidad</span>
                  <select name="modalidad" className="campo mt-1">
                    <option value="presencial">Presencial</option>
                    <option value="online">Online</option>
                  </select>
                </label>
              )}
              <label className="block">
                <span className="text-[13px] font-medium">Procedimiento</span>
                <select name="procedimiento" className="campo mt-1">
                  <option value="">—</option>
                  {procedimientos.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-[13px] font-medium">Notas</span>
              <input name="notas" className="campo mt-1" />
            </label>

            <label className="flex items-center gap-2 text-[13px] text-[var(--color-tinta-2)]">
              <input type="checkbox" name="forzar" value="1" />
              Agendar igual aunque choque con otra cita o un bloqueo
            </label>

            <Boton>Agendar</Boton>
          </FormAccion>
        ) : (
          <FormAccion accion={bloquear} className="space-y-3">
            <p className="text-[13px] text-[var(--color-tinta-2)]">
              El rango queda ocupado (el cupo <strong>no</strong> se libera) y a cada paciente afectado
              se le manda la cancelación con su enlace para reagendar.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-[13px] font-medium">Fecha</span>
                <input name="fecha" type="date" defaultValue={fecha} className="campo mt-1" required />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">Desde</span>
                <input name="hora_inicio" type="time" step={300} className="campo mt-1" required />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">Hasta</span>
                <input name="hora_fin" type="time" step={300} className="campo mt-1" required />
              </label>
            </div>
            <label className="block">
              <span className="text-[13px] font-medium">Motivo</span>
              <input name="motivo" className="campo mt-1" placeholder="Emergencia quirúrgica" />
            </label>
            <Boton variante="peligro">Bloquear y avisar</Boton>
          </FormAccion>
        )}
      </div>
    </div>
  );
}
