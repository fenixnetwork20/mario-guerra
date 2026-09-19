import { NextResponse } from 'next/server';
import { usuarioActual } from '@/lib/auth';
import { instrucciones } from '@/lib/ayuda';
import { permitido } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const MODELO = 'google/gemini-2.5-flash';

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: 'Sesión vencida. Entra de nuevo.' }, { status: 401 });

  // Un techo por persona: esto cuesta dinero por pregunta.
  if (!permitido(`ayuda:${usuario.id}`, 40, 3600)) {
    return NextResponse.json({ error: 'Muchas preguntas seguidas. Espera un momento.' }, { status: 429 });
  }

  const clave = process.env.OPENROUTER_API_KEY;
  if (!clave) {
    return NextResponse.json(
      { error: 'El ayudante no está configurado todavía. Repórtalo con el botón de abajo.' },
      { status: 503 }
    );
  }

  let b: { mensajes?: { rol: 'usuario' | 'ayudante'; texto: string }[] };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 }); }

  // Solo los últimos turnos: la conversación no necesita memoria larga y el
  // manual ya ocupa lo suyo en cada llamada.
  const historial = (b.mensajes ?? []).slice(-8).map((m) => ({
    role: m.rol === 'usuario' ? 'user' : 'assistant',
    content: String(m.texto).slice(0, 1500),
  }));
  if (!historial.length) return NextResponse.json({ error: 'Escribe tu pregunta.' }, { status: 400 });

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0.2,
        max_tokens: 700,
        messages: [{ role: 'system', content: instrucciones(usuario) }, ...historial],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`openrouter ${r.status}`);
    const d = await r.json();
    const texto = (d.choices?.[0]?.message?.content || '').trim();
    if (!texto) throw new Error('respuesta vacía');
    return NextResponse.json({ texto });
  } catch (e) {
    console.error('ayuda', e);
    return NextResponse.json(
      { error: 'No pude responderte ahora mismo. Intenta de nuevo en un momento.' },
      { status: 502 }
    );
  }
}
