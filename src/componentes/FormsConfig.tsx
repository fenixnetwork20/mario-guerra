'use client';

import { FormAccion, Boton } from '@/componentes/FormAccion';
import type { Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

export function FormPlantilla({
  accion, plantilla,
}: {
  accion: Accion;
  plantilla: { id: number; clave: string; nombre: string; meta_template_name: string | null; idioma: string; variables: string; cuerpo_ejemplo: string | null; activa: number };
}) {
  const vars: string[] = JSON.parse(plantilla.variables || '[]');
  return (
    <FormAccion accion={accion} className="space-y-3">
      <input type="hidden" name="plantilla_id" value={plantilla.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="titulo text-[16px]">{plantilla.nombre}</h3>
          <p className="text-[12.5px] text-[var(--color-tinta-3)]">clave interna: {plantilla.clave}</p>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="activa" value="1" defaultChecked={!!plantilla.activa} />
          Activa
        </label>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-[12.5px] font-medium">Nombre aprobado en Meta</span>
          <input name="meta_template_name" className="campo mt-1"
            defaultValue={plantilla.meta_template_name ?? ''} placeholder="recordatorio_cita_1" />
        </label>
        <label className="block">
          <span className="text-[12.5px] font-medium">Idioma</span>
          <input name="idioma" className="campo mt-1" defaultValue={plantilla.idioma} />
        </label>
      </div>
      <label className="block">
        <span className="text-[12.5px] font-medium">Texto de referencia (el real vive en Meta)</span>
        <textarea name="cuerpo_ejemplo" rows={2} className="campo mt-1" defaultValue={plantilla.cuerpo_ejemplo ?? ''} />
      </label>
      <p className="text-[12.5px] text-[var(--color-tinta-3)]">
        Variables en orden: {vars.map((v) => `{{${v}}}`).join(' · ') || 'ninguna'}
      </p>
      <Boton variante="borde">Guardar plantilla</Boton>
    </FormAccion>
  );
}

export function FormEnvioManual({
  accion, citas, plantillas,
}: {
  accion: Accion;
  citas: { id: number; etiqueta: string }[];
  plantillas: { clave: string; nombre: string }[];
}) {
  return (
    <FormAccion accion={accion} className="flex flex-wrap items-end gap-2">
      <label className="block flex-1 min-w-[240px]">
        <span className="text-[12.5px] font-medium">Cita</span>
        <select name="cita_id" className="campo mt-1" required>
          <option value="">—</option>
          {citas.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
        </select>
      </label>
      <label className="block w-56">
        <span className="text-[12.5px] font-medium">Plantilla</span>
        <select name="plantilla" className="campo mt-1" required>
          <option value="">—</option>
          {plantillas.map((p) => <option key={p.clave} value={p.clave}>{p.nombre}</option>)}
        </select>
      </label>
      <Boton>Enviar</Boton>
    </FormAccion>
  );
}

export function FormAjustes({ accion, cfg }: { accion: Accion; cfg: Record<string, string> }) {
  const campo = (clave: string, etiqueta: string, tipo = 'text', ancho = '') => (
    <label className={`block ${ancho}`} key={clave}>
      <span className="text-[12.5px] font-medium">{etiqueta}</span>
      <input name={clave} type={tipo} className="campo mt-1" defaultValue={cfg[clave] ?? ''} />
    </label>
  );

  return (
    <FormAccion accion={accion} className="space-y-5">
      <div>
        <p className="etiqueta">Agenda</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-2">
          {campo('duracion_cita', 'Duración de cita (min)', 'number')}
          {campo('dias_max_reserva', 'Días que se pueden reservar hacia adelante', 'number')}
          {campo('horas_min_anticipacion', 'Anticipación mínima (horas)', 'number')}
        </div>
      </div>

      <div>
        <p className="etiqueta">Consulta (USD)</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          {campo('precio_consulta_presencial', 'Presencial', 'number')}
          {campo('precio_consulta_online', 'Online', 'number')}
        </div>
      </div>

      <div>
        <p className="etiqueta">Datos para cobrar la consulta</p>
        <p className="text-[12.5px] text-[var(--color-tinta-3)] mt-1.5 leading-relaxed">
          Es lo que verá el paciente al reservar, para pagar y subir su comprobante.
          Los códigos QR se suben más abajo.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          {campo('pm_banco', 'Pago móvil · banco')}
          {campo('pm_telefono', 'Pago móvil · teléfono')}
          {campo('pm_cedula', 'Pago móvil · cédula o RIF')}
          {campo('pm_titular', 'Pago móvil · titular')}
          {campo('binance_usuario', 'Binance · usuario o correo')}
          <div />
          {campo('zelle_correo', 'Zelle · correo o teléfono')}
          {campo('zelle_titular', 'Zelle · titular')}
        </div>
        <label className="flex items-center gap-2 text-[13.5px] mt-3">
          <input type="checkbox" name="efectivo_activo" value="1" defaultChecked={cfg.efectivo_activo === '1'} />
          Aceptar efectivo: el paciente paga en el consultorio el día de su cita
        </label>
      </div>

      <div>
        <p className="etiqueta">Recordatorios y auto-cancelación (hora de Venezuela)</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-2">
          {campo('r1_hora_inicio', 'R1 · desde (día antes)', 'time')}
          {campo('r1_hora_fin', 'R1 · hasta (día antes)', 'time')}
          {campo('hora_corte', 'Hora de corte', 'time')}
          {campo('r2_hora_dia', 'R2 · citas después del corte', 'time')}
          {campo('autocancel_offset_horas', 'Auto-cancelar tras R2 (horas)', 'number')}
          <div />
          {campo('r2_hora_noche_anterior', 'R2 · citas al corte o antes (noche anterior)', 'time')}
          {campo('autocancel_hora_noche_anterior', 'Auto-cancelar (noche anterior)', 'time')}
        </div>
      </div>

      <div>
        <p className="etiqueta">Datos del consultorio</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          {campo('nombre_consultorio', 'Nombre')}
          {campo('direccion', 'Dirección')}
          {campo('whatsapp_consultorio', 'WhatsApp del consultorio')}
          {campo('whatsapp_emergencias', 'WhatsApp de emergencias')}
        </div>
      </div>

      <div>
        <p className="etiqueta">Mensajería</p>
        <label className="flex items-center gap-2 text-[13.5px] mt-2">
          <input type="checkbox" name="mensajeria_activa" value="1" defaultChecked={cfg.mensajeria_activa === '1'} />
          Enviar de verdad por WhatsApp (Meta). Apagado = modo simulado, no gasta mensajes.
        </label>
      </div>

      <Boton>Guardar configuración</Boton>
    </FormAccion>
  );
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function FormHorario({ accion }: { accion: Accion }) {
  return (
    <FormAccion accion={accion} className="flex flex-wrap items-end gap-2">
      <label className="block w-40">
        <span className="text-[12.5px] font-medium">Día</span>
        <select name="dia_semana" className="campo mt-1">
          {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </label>
      <label className="block w-32">
        <span className="text-[12.5px] font-medium">Desde</span>
        <input name="hora_inicio" type="time" className="campo mt-1" required />
      </label>
      <label className="block w-32">
        <span className="text-[12.5px] font-medium">Hasta</span>
        <input name="hora_fin" type="time" className="campo mt-1" required />
      </label>
      <Boton variante="borde">Agregar</Boton>
    </FormAccion>
  );
}

export function FormProcedimiento({
  accion, procedimiento,
}: {
  accion: Accion;
  procedimiento?: { id: number; nombre: string; precio_referencia: number | null; activo: number };
}) {
  return (
    <FormAccion accion={accion} className="flex flex-wrap items-end gap-2">
      {procedimiento && <input type="hidden" name="procedimiento_id" value={procedimiento.id} />}
      <label className="block flex-1 min-w-[200px]">
        <span className="text-[12.5px] font-medium">Procedimiento</span>
        <input name="nombre" className="campo mt-1" defaultValue={procedimiento?.nombre ?? ''} required />
      </label>
      <label className="block w-40">
        <span className="text-[12.5px] font-medium">Precio referencia</span>
        <input name="precio_referencia" type="number" step="0.01" min="0" className="campo mt-1"
          defaultValue={procedimiento?.precio_referencia ?? ''} />
      </label>
      {procedimiento && (
        <label className="flex items-center gap-2 text-[13px] pb-2">
          <input type="checkbox" name="activo" value="1" defaultChecked={!!procedimiento.activo} />
          Visible
        </label>
      )}
      <Boton variante="borde">{procedimiento ? 'Guardar' : 'Agregar'}</Boton>
    </FormAccion>
  );
}

export function FormUsuario({
  accion, usuario,
}: {
  accion: Accion;
  usuario: { id: number; email: string; nombre: string; rol: string; activo: number };
}) {
  return (
    <FormAccion accion={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="usuario_id" value={usuario.id} />
      <div className="min-w-[200px]">
        <p className="text-[13.5px] font-medium">{usuario.email}</p>
        <p className="text-[12.5px] text-[var(--color-tinta-3)] capitalize">{usuario.rol}</p>
      </div>
      <label className="block w-52">
        <span className="text-[12.5px] font-medium">Nombre</span>
        <input name="nombre" className="campo mt-1" defaultValue={usuario.nombre} required />
      </label>
      <label className="block w-52">
        <span className="text-[12.5px] font-medium">Nueva contraseña</span>
        <input name="clave" type="password" className="campo mt-1" placeholder="dejar vacío = sin cambio" />
      </label>
      <label className="flex items-center gap-2 text-[13px] pb-2">
        <input type="checkbox" name="activo" value="1" defaultChecked={!!usuario.activo} />
        Activo
      </label>
      <Boton variante="borde">Guardar</Boton>
    </FormAccion>
  );
}
