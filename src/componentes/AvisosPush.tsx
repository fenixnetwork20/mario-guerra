'use client';

import { useEffect, useState } from 'react';
import { api, ruta } from '@/lib/rutas';

type Estado = 'cargando' | 'no-soportado' | 'apagado' | 'encendido' | 'bloqueado';

/**
 * Enciende los avisos del panel en ESTE aparato. Una suscripción es un
 * navegador, no una persona: hay que activarlo en el teléfono y en la
 * computadora por separado, y eso es justo lo que dice el texto.
 */
export function AvisosPush() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setEstado('no-soportado');
        return;
      }
      if (Notification.permission === 'denied') { setEstado('bloqueado'); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration(ruta('/sw.js'));
        const sus = await reg?.pushManager.getSubscription();
        setEstado(sus ? 'encendido' : 'apagado');
      } catch {
        setEstado('apagado');
      }
    })();
  }, []);

  async function encender() {
    setError(null);
    setTrabajando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') { setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado'); return; }

      const reg = await navigator.serviceWorker.register(ruta('/sw.js'));
      await navigator.serviceWorker.ready;

      const r = await fetch(api('/api/panel/push'));
      const { clave } = await r.json();
      if (!clave) { setError('Faltan las claves de notificación en el servidor.'); return; }

      const sus =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: aBytes(clave),
        }));

      const guardar = await fetch(api('/api/panel/push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suscripcion: sus.toJSON(), dispositivo: navigator.userAgent.slice(0, 120) }),
      });
      if (!guardar.ok) { setError('No se pudo guardar en el servidor.'); return; }
      setEstado('encendido');
    } catch (e) {
      setError(`No se pudo activar: ${String(e).slice(0, 90)}`);
    } finally {
      setTrabajando(false);
    }
  }

  async function apagar() {
    setTrabajando(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(ruta('/sw.js'));
      const sus = await reg?.pushManager.getSubscription();
      if (sus) {
        await fetch(api('/api/panel/push'), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sus.endpoint }),
        });
        await sus.unsubscribe();
      }
      setEstado('apagado');
    } finally {
      setTrabajando(false);
    }
  }

  if (estado === 'cargando') return null;

  return (
    <div className="tarjeta p-5 space-y-3">
      <div>
        <p className="etiqueta">Avisos en este aparato</p>
        <p className="text-[14px] text-[var(--color-tinta-2)] mt-2 leading-relaxed">
          {estado === 'encendido'
            ? 'Este aparato ya recibe los avisos del consultorio, aunque tengas el panel cerrado.'
            : 'Recibe un aviso cuando entra una reserva, cuando un paciente cancela y cuando el bot pasa una conversación a una persona.'}
        </p>
        <p className="text-[12.5px] text-[var(--color-tinta-3)] mt-2 leading-relaxed">
          Se activa por aparato: hazlo en el teléfono y en la computadora por separado.
          En iPhone hay que agregar la página a la pantalla de inicio primero.
        </p>
      </div>

      {estado === 'no-soportado' && (
        <p className="text-[13.5px] text-[var(--color-alerta)]">
          Este navegador no admite avisos. En iPhone, agrega la página a la pantalla de inicio y ábrela desde ahí.
        </p>
      )}
      {estado === 'bloqueado' && (
        <p className="text-[13.5px] text-[var(--color-alerta)]">
          Los avisos están bloqueados para este sitio. Habilítalos en los ajustes del navegador (el candado junto a la dirección) y vuelve a intentar.
        </p>
      )}
      {error && <p className="text-[13.5px] text-[var(--color-alerta)]">{error}</p>}

      {estado === 'apagado' && (
        <button className="btn btn-principal" disabled={trabajando} onClick={encender}>
          {trabajando ? 'Activando…' : 'Activar avisos aquí'}
        </button>
      )}
      {estado === 'encendido' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="pill bg-[var(--color-acento-luz)] text-[var(--color-acento)]">Activados</span>
          <button className="btn btn-borde" disabled={trabajando} onClick={apagar}>
            Desactivar en este aparato
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * La clave VAPID viaja en base64url y el navegador la pide en bytes. El buffer
 * se crea aparte a propósito: TypeScript exige un ArrayBuffer de verdad, y un
 * Uint8Array suelto no le sirve como applicationServerKey.
 */
function aBytes(base64url: string): ArrayBuffer {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(base64);
  const buffer = new ArrayBuffer(crudo.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return buffer;
}
