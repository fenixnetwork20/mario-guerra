'use client';

import { useState } from 'react';
import { FormAccion, Boton } from '@/componentes/FormAccion';
import type { Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

/** Contenedor plegable: la ficha tiene muchos formularios y no todos hacen falta a la vez. */
export function Plegable({
  titulo, children, abiertoPorDefecto = false,
}: {
  titulo: string; children: React.ReactNode; abiertoPorDefecto?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);
  return (
    <div className="rounded-lg border border-[var(--color-linea)] bg-[var(--color-papel)]">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-[13.5px] font-semibold"
        onClick={() => setAbierto((v) => !v)}
      >
        {titulo}
        <span className="text-[var(--color-tinta-3)]">{abierto ? '−' : '+'}</span>
      </button>
      {abierto && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function FormPaciente({
  accion, paciente,
}: {
  accion: Accion;
  paciente?: { id: number; nombre: string; cedula: string; whatsapp: string; edad: number | null; notas_medicas: string | null };
}) {
  return (
    <FormAccion accion={accion} className="space-y-3">
      {paciente && <input type="hidden" name="paciente_id" value={paciente.id} />}
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[13px] font-medium">Nombre y apellido</span>
          <input name="nombre" className="campo mt-1" defaultValue={paciente?.nombre} required />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Cédula</span>
          <input name="cedula" className="campo mt-1" defaultValue={paciente?.cedula} required />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">WhatsApp</span>
          <input name="whatsapp" className="campo mt-1" defaultValue={paciente?.whatsapp} required />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Edad</span>
          <input name="edad" type="number" min={1} max={120} className="campo mt-1" defaultValue={paciente?.edad ?? ''} />
        </label>
      </div>
      <label className="block">
        <span className="text-[13px] font-medium">Notas y condiciones médicas</span>
        <textarea name="notas_medicas" rows={3} className="campo mt-1" defaultValue={paciente?.notas_medicas ?? ''} />
      </label>
      <Boton>{paciente ? 'Guardar cambios' : 'Crear paciente'}</Boton>
    </FormAccion>
  );
}

export function FormPago({
  accion, pacienteId, cirugias, cuotaId, montoSugerido, cirugiaSugerida,
}: {
  accion: Accion; pacienteId: number;
  cirugias: { id: number; procedimiento: string }[];
  cuotaId?: number; montoSugerido?: number; cirugiaSugerida?: number;
}) {
  return (
    <FormAccion accion={accion} className="space-y-3">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      {cuotaId && <input type="hidden" name="cuota_id" value={cuotaId} />}
      <div className="grid sm:grid-cols-4 gap-3">
        <label className="block">
          <span className="text-[13px] font-medium">Monto (USD)</span>
          <input name="monto" type="number" step="0.01" min="0.01" className="campo mt-1"
            defaultValue={montoSugerido ?? ''} required />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Método</span>
          <select name="metodo" className="campo mt-1" required>
            <option value="">—</option>
            <option value="efectivo">Efectivo</option>
            <option value="zelle">Zelle</option>
            <option value="binance">Binance</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Fecha</span>
          <input name="fecha" type="date" className="campo mt-1" />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Cirugía</span>
          <select name="cirugia_id" className="campo mt-1" defaultValue={cirugiaSugerida ?? ''}>
            <option value="">Sin ligar</option>
            {cirugias.map((c) => <option key={c.id} value={c.id}>{c.procedimiento}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-[13px] font-medium">Concepto</span>
        <input name="concepto" className="campo mt-1" placeholder="Abono, inicial, consulta…" />
      </label>
      <Boton>Registrar pago</Boton>
    </FormAccion>
  );
}

export function FormCargo({
  accion, pacienteId, cirugias,
}: {
  accion: Accion; pacienteId: number; cirugias: { id: number; procedimiento: string }[];
}) {
  return (
    <FormAccion accion={accion} className="space-y-3">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <div className="grid sm:grid-cols-4 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-[13px] font-medium">Concepto</span>
          <input name="concepto" className="campo mt-1" required />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Monto (USD)</span>
          <input name="monto" type="number" step="0.01" min="0.01" className="campo mt-1" required />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Cirugía</span>
          <select name="cirugia_id" className="campo mt-1">
            <option value="">Sin ligar</option>
            {cirugias.map((c) => <option key={c.id} value={c.id}>{c.procedimiento}</option>)}
          </select>
        </label>
      </div>
      <Boton variante="borde">Agregar cargo</Boton>
    </FormAccion>
  );
}

export function FormCirugia({
  accion, pacienteId, procedimientos, precios, cirugia,
}: {
  accion: Accion; pacienteId: number; procedimientos: string[];
  precios: Record<string, number | null>;
  cirugia?: { id: number; procedimiento: string; fecha: string | null; precio_acordado: number; estado: string; notas: string | null };
}) {
  const [proc, setProc] = useState(cirugia?.procedimiento ?? '');
  const referencia = precios[proc];

  return (
    <FormAccion accion={accion} className="space-y-3">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      {cirugia && <input type="hidden" name="cirugia_id" value={cirugia.id} />}
      <div className="grid sm:grid-cols-4 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-[13px] font-medium">Procedimiento</span>
          <select name="procedimiento" className="campo mt-1" value={proc}
            onChange={(e) => setProc(e.target.value)} required>
            <option value="">—</option>
            {procedimientos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Fecha</span>
          <input name="fecha" type="date" className="campo mt-1" defaultValue={cirugia?.fecha ?? ''} />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Precio acordado (USD)</span>
          <input
            key={proc}
            name="precio_acordado" type="number" step="0.01" min="0" className="campo mt-1"
            defaultValue={cirugia?.precio_acordado ?? (referencia ?? '')}
          />
          {referencia != null && (
            <span className="text-[12px] text-[var(--color-tinta-3)]">Referencia interna: ${referencia}</span>
          )}
        </label>
      </div>
      {cirugia && (
        <label className="block">
          <span className="text-[13px] font-medium">Estado</span>
          <select name="estado" className="campo mt-1" defaultValue={cirugia.estado}>
            <option value="programada">Programada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-[13px] font-medium">Notas</span>
        <input name="notas" className="campo mt-1" defaultValue={cirugia?.notas ?? ''} />
      </label>
      <p className="text-[12.5px] text-[var(--color-tinta-3)]">
        Al guardar con fecha, las revisiones postoperatorias se programan solas
        (4 el primer mes, una a los 3 meses y una al año).
      </p>
      <Boton>{cirugia ? 'Guardar cirugía' : 'Registrar cirugía'}</Boton>
    </FormAccion>
  );
}

export function FormCosto({ accion, cirugiaId }: { accion: Accion; cirugiaId: number }) {
  return (
    <FormAccion accion={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="cirugia_id" value={cirugiaId} />
      <label className="block flex-1 min-w-[160px]">
        <span className="text-[12.5px] font-medium">Concepto</span>
        <input name="concepto" className="campo mt-1" placeholder="Pabellón, anestesia…" required />
      </label>
      <label className="block w-32">
        <span className="text-[12.5px] font-medium">Monto</span>
        <input name="monto" type="number" step="0.01" min="0.01" className="campo mt-1" required />
      </label>
      <label className="block w-40">
        <span className="text-[12.5px] font-medium">Fecha</span>
        <input name="fecha" type="date" className="campo mt-1" />
      </label>
      <Boton variante="borde">Agregar costo</Boton>
    </FormAccion>
  );
}

export function FormPlan({
  accion, cirugiaId, totalSugerido,
}: {
  accion: Accion; cirugiaId: number; totalSugerido: number;
}) {
  return (
    <FormAccion accion={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="cirugia_id" value={cirugiaId} />
      <label className="block w-32">
        <span className="text-[12.5px] font-medium">Total</span>
        <input name="total" type="number" step="0.01" min="0.01" className="campo mt-1"
          defaultValue={totalSugerido || ''} required />
      </label>
      <label className="block w-32">
        <span className="text-[12.5px] font-medium">Inicial</span>
        <input name="inicial" type="number" step="0.01" min="0" className="campo mt-1" defaultValue={0} />
      </label>
      <label className="block w-28">
        <span className="text-[12.5px] font-medium">Meses</span>
        <select name="meses" className="campo mt-1">
          <option value="1">1</option>
          <option value="3">3</option>
          <option value="6">6</option>
        </select>
      </label>
      <label className="block w-40">
        <span className="text-[12.5px] font-medium">Inicio</span>
        <input name="fecha_inicio" type="date" className="campo mt-1" />
      </label>
      <Boton variante="borde">Crear plan</Boton>
    </FormAccion>
  );
}

export function FormDocumento({ accion, pacienteId }: { accion: Accion; pacienteId: number }) {
  return (
    <FormAccion accion={accion} className="space-y-3">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <div className="grid sm:grid-cols-4 gap-3">
        <label className="block">
          <span className="text-[13px] font-medium">Tipo</span>
          <select name="tipo" className="campo mt-1">
            <option value="examen">Examen</option>
            <option value="documento">Documento</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[13px] font-medium">Nombre</span>
          <input name="nombre" className="campo mt-1" placeholder="Hematología completa" />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Fecha</span>
          <input name="fecha" type="date" className="campo mt-1" />
        </label>
      </div>
      <input name="archivo" type="file" className="campo" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" required />
      <Boton variante="borde">Subir archivo</Boton>
    </FormAccion>
  );
}

export function BotonForm({
  accion, campos, texto, variante = 'borde', confirmar,
}: {
  accion: Accion; campos: Record<string, string | number>; texto: string;
  variante?: 'principal' | 'borde' | 'peligro'; confirmar?: string;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  if (confirmar && !pidiendo) {
    return (
      <button className={`btn btn-${variante === 'principal' ? 'principal' : variante === 'peligro' ? 'peligro' : 'borde'} h-8 px-2.5 text-[12.5px]`}
        onClick={() => setPidiendo(true)}>
        {texto}
      </button>
    );
  }
  return (
    <FormAccion accion={accion} className="inline-flex items-center gap-2">
      {Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {confirmar && <span className="text-[12.5px] text-[var(--color-tinta-2)]">{confirmar}</span>}
      <Boton variante={variante} className="h-8 px-2.5 text-[12.5px]">{texto}</Boton>
    </FormAccion>
  );
}
