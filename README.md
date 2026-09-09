# Plataforma Dr. Mario Guerra

Sistema interno de operaciones + reserva de citas por autoservicio del consultorio del
Dr. Mario Arturo Guerra Pineda (cirugía plástica, Maracaibo).

- **Producción:** https://drmarioguerra.com
- **Local:** http://127.0.0.1:3320
- **Proceso:** PM2 `marioguerra` (puerto 3320) · **Ruteo:** Traefik, `/root/traefik-dynamic/fenixflowai.yml`
- **Zona horaria de toda la lógica:** America/Caracas (VET, UTC−4). El VPS corre en UTC;
  las fechas se guardan como texto `YYYY-MM-DD HH:MM` ya en hora de Venezuela.
- **Moneda única:** USD. No hay tasas ni bolívares en ninguna parte.

## Accesos

| Cuenta | Rol |
|---|---|
| `recepcion@marioguerra.local` | recepción |
| `doctor@marioguerra.local` | doctor |

| Módulo | Recepción | Doctor |
|---|---|---|
| Agenda (agendar, bloquear, cancelar, reprogramar) | ✅ | ✅ |
| Fichas de pacientes | ✅ (ver + editar + subir) | ✅ (ver + subir) |
| Registrar pagos, cargos y planes de financiamiento | ✅ | ✅ |
| Sección **Dinero**: ganancias, costos de operación, resúmenes del mes | ✅ | ✅ |
| Gastos fijos | ✅ | ✅ |
| Mensajería · Seguimiento · Configuración | ✅ | ✅ |

La recepcionista es la **asistente del doctor** y maneja todo el dinero (confirmado por el
doctor el 2026-09-09). La única diferencia que queda entre los dos roles es que el doctor no
edita los datos personales del paciente ni borra documentos; todo lo demás es igual.

La matriz vive en `src/lib/permisos.ts` y es la única puerta: cada acción del servidor pasa
por `exigirPermiso()` antes de tocar la base. Cambiar un permiso ahí lo cambia en todas
partes —menú, secciones y formularios— sin tocar nada más.

## Dominio

**Producción: https://drmarioguerra.com** (con `www`). Todo vive en la raíz del dominio.

`fenixflowai.com/marioguerra/*` quedó como **redirección permanente 301** al dominio nuevo,
conservando la ruta: los enlaces de gestión de cita que ya se enviaron a pacientes siguen
funcionando (`/marioguerra/cita/TOKEN` → `drmarioguerra.com/cita/TOKEN`).

- DNS en Hostinger (nameservers `*.dns-parking.com`), registro **A** de la raíz →
  `217.196.49.214`. `www` es CNAME a la raíz.
- Certificado Let's Encrypt emitido por Traefik (`certResolver: mytlschallenge`).
- Routers y la redirección viven en `/root/traefik-dynamic/fenixflowai.yml`
  (respaldos `*.bak-predominio-*`).

El prefijo de la app sale de `NEXT_PUBLIC_BASE_PATH` (hoy **vacío**) y se aplica en
`next.config.ts` y en el helper `ruta()` de `src/lib/rutas.ts`. Toda ruta escrita a mano
—imágenes, `fetch`, enlaces sueltos— pasa por ese helper: `next/link` y el router aplican el
basePath solos, esos tres no.

> `PUBLIC_BASE_URL` es lo que arma los enlaces que se mandan por WhatsApp. Si algún día se
> cambia el dominio y no se cambia esa variable, los recordatorios seguirán enviando enlaces
> muertos. Hoy: `https://drmarioguerra.com`.

## Marca

Los archivos originales del manual (logos en PNG/JPG/PDF/AI/EPS y las piezas de carrete)
están en `branding/`, extraídos del zip de Drive que estaba en `/root/mario guerra/`.
Lo que usa la app vive optimizado en `public/marca/`:

| Archivo | Uso |
|---|---|
| `monograma.png` | encabezado del panel (monograma en petróleo) |
| `monograma-claro.png` | encabezado público, sobre fondo oscuro |
| `logo.png` / `logo-claro.png` | lockup completo, por si hace falta en impresos |
| `sello.png` | sello circular — pantalla de acceso |
| `src/app/icon.png` | favicon: monograma nude sobre petróleo |

**Paleta** (los hex salen directo de las variantes del logo, no son aproximaciones):

| Token | Hex | Uso |
|---|---|---|
| `--color-tinta` | `#061720` | petróleo del logo; texto principal y encabezado público |
| `--color-acento` | `#2d383e` | gris azulado del sello; botones y acciones |
| `--color-cobre` | `#7c5943` | cifras positivas, enlaces, detalles |
| `--color-cobre-luz` | `#aa7553` | acentos claros |
| `--color-nude` | `#d5c8c8` | texto sobre oscuro y resaltes suaves |
| `--color-papel` | `#f7f5f3` | fondo |

**Fondo y superficies:** el papel no es un plano liso ni las tarjetas son blanco puro.
El fondo lleva un degradado tibio que baja del nude al papel más un grano SVG casi
imperceptible (`body::before`), y las tarjetas van en hueso `#fffdfb` con sombra suave.
Es la textura del material impreso de la marca, sin quitarle protagonismo a los datos.

**Tipografía:** Montserrat (`next/font/google`), que es la geométrica con la que está
armado el logotipo. La clase `.marca` reproduce el tratamiento del sello: versalitas con
tracking ancho. Los títulos van en la misma familia a 600 — no hay serif en el sistema.

## Landing (`/marioguerra`)

Una sola página larga con anclas, construida sobre el mismo sistema de módulos. Es el index
del proyecto: `/reservar` y `/panel` siguen siendo rutas internas del mismo Next.

Secciones, en orden: hero a pantalla completa · enfoque del doctor · procedimientos por
categoría · resultados · **sí / no** · credenciales · testimonios (oculta) · la consulta ·
financiamiento · contacto con mapa · pie.

- **El elemento firma es la sección "sí / no"** (`SiNo` en `src/app/page.tsx`): la página se
  parte en dos, nude a un lado y petróleo al otro con una línea de cobre en medio. Es lo más
  distintivo del brief —un cirujano diciendo en público lo que **no** hace— así que la
  composición dice lo mismo que el texto.
- **Procedimientos** se abren en la misma página (`src/componentes/landing/Procedimientos.tsx`);
  no hay subpáginas. Cada uno muestra recuperación y anestesia. **Nunca precios.**
- **Movimiento:** crossfade del hero, encabezado que se encoge al bajar, aparición al hacer
  scroll, zoom suave en las imágenes, scroll suave en las anclas. Todo se apaga con
  `prefers-reduced-motion`.
- **Móvil primero:** menú hamburguesa a pantalla completa y barra fija abajo con los dos CTA,
  para que agendar nunca quede fuera de alcance.

### Lo que falta cargar (y dónde)

| Qué | Dónde | Estado |
|---|---|---|
| Más fotos del doctor | arreglo `fotos` del `<HeroLanding>` en `src/app/page.tsx` | Con una sola foto el crossfade se queda quieto; al agregar entradas arranca solo |
| Testimonios reales | constante `TESTIMONIOS` en `src/app/page.tsx` | Vacía a propósito. La sección no se dibuja mientras no haya ninguno: **no se inventan reseñas de pacientes** |
| Galería de resultados | sección `#resultados` | Hoy solo enlaza al perfil de Instagram. El feed embebido real necesita token de Meta o un servicio externo |
| Imágenes de categorías | cards de `Procedimientos` | Hoy son tipográficas; el componente acepta imagen sin rehacer nada |

## Páginas públicas: módulos y movimiento

Las páginas del paciente (`/reservar` y `/cita/{token}`) están armadas como un
**sistema de módulos apilados**, no como pantallas sueltas — el patrón de
radyrahban.com, que el cliente puso como referencia:

- `Portada` — media imagen: texto a la izquierda, foto ocupando la mitad derecha y
  fundiéndose en el petróleo. En móvil la foto pasa a fondo atenuado. Variante `compacta`.
- `Divisor` — la línea fina entre bloques.
- `.modulo` / `.modulo-oscuro` — el bloque y su variante oscura.
- `.contenedor` — el ancho de lectura. **Solo aplica padding lateral**: usar el atajo
  `padding` aquí le gana a las utilidades `py-*` de Tailwind (esta hoja va fuera de sus
  capas) y aplasta los bloques.

**El movimiento es un solo gesto, repetido.** Los bloques aparecen con opacidad y 18px de
subida al entrar en pantalla (`<Aparece>`, IntersectionObserver + CSS, sin librerías), y la
foto de portada entra con un acercamiento lento. Nada más. Repetido con disciplina se lee
caro; variado se lee inquieto.

> **La red de seguridad importa más que la animación.** El estado oculto vive en
> `.js .aparece`, y la clase `js` la pone un script en línea antes de pintar. Si el
> JavaScript no carga, **el contenido se ve igual** — esta es la página que toma las citas
> y no puede quedarse en blanco por un efecto. Además `<Aparece>` revela a los 4 segundos
> pase lo que pase, y todo se desactiva con `prefers-reduced-motion`.

**Fotografía:** extraída de las piezas de carrete del kit (`branding/`), recortada para
sacar el sello y los textos: `foto-doctor.jpg` (portada) y `foto-quirofano.jpg` (módulo
oscuro, recortada por encima del campo quirúrgico — el paciente que va a agendar no
necesita ver eso).

> Al cambiar una foto de `public/marca/`, borrar `.next/cache/images` y reiniciar: el
> optimizador cachea por URL y sigue sirviendo la vieja.

## Anchos

Hay dos escalas distintas y conviene no confundirlas:

| Clase | Ancho | Para qué |
|---|---|---|
| `.contenedor` | hasta **1600px**, con padding lateral `clamp(1.25rem, 4vw, 4.5rem)` | La landing y las cabeceras: la página se estira con el monitor |
| `.contenedor-estrecho` | hasta **928px** | Reserva y ficha de cita: son formularios, se leen mejor angostos |
| `.medida` | 44rem | Párrafos largos dentro de un contenedor ancho |

La regla: **la página se estira con el monitor, el texto no.** Una línea de 2000px no se lee.
En ultrawide, las rejillas (categorías, procedimientos, contacto) son las que aprovechan el
espacio; los párrafos se quedan en su medida.

## Ancho de pantalla del panel

El panel tiene tres anchos, elegibles desde el ícono al lado de la campanita:
**compacto** (1152 px), **ancho** (1600 px, por defecto) y **pantalla completa**.
La preferencia se guarda en la cookie `mg_ancho`, así que el servidor ya renderiza con el
ancho correcto y no se ve el salto al cargar. Es por navegador: el doctor y recepción
pueden tener anchos distintos, y el mismo usuario puede tener uno en el ultrawide del
consultorio y otro en el portátil. Las páginas públicas mantienen ancho de lectura.

## Stack

Next.js 16 (App Router) · SQLite (`better-sqlite3`) · Tailwind v4 · PM2.

> El spec original pedía Supabase (Auth/Storage/RLS). Se construyó sobre **SQLite local**
> por decisión del cliente. Los equivalentes:
> - **Auth:** sesión propia con cookie httpOnly firmada con HMAC-SHA256 (`SESSION_SECRET`) y
>   contraseñas con bcrypt → `src/lib/auth.ts`.
> - **RLS:** SQLite no la tiene. El equivalente es una única puerta de permisos en el servidor:
>   **toda** acción pasa por `exigirPermiso()` (`src/lib/permisos.ts`) antes de tocar la base.
>   La UI solo esconde botones; el permiso se verifica del lado del servidor.
> - **Storage:** archivos en `data/uploads/`, servidos solo con sesión abierta por
>   `/api/documentos/[id]`. Nunca quedan en `/public`.
>
> Migrar a Supabase después implica reescribir `src/lib/db.ts` y las consultas; el resto
> del sistema (reglas, cálculos, pantallas) no cambia.

## Estructura

```
db/schema.sql              esquema completo
scripts/init-db.mjs        crea la base y siembra config, horarios, catálogo, plantillas y usuarios
scripts/cron-tick.sh       lo llama el cron cada 15 min
src/lib/fechas.ts          toda la aritmética de tiempo en VET
src/lib/agenda.ts          cupos libres, choques, bloqueos
src/lib/citas.ts           reservar, confirmar, cancelar, reprogramar, bloquear
src/lib/recordatorios.ts   el tick: R1, R2, auto-cancelación, avisos de cuotas
src/lib/dinero.ts          deuda calculada, planes, cuotas, resúmenes
src/lib/cirugias.ts        cirugías y calendario fijo de revisiones postop
src/lib/mensajeria.ts      interfaz de envío (simulado | Meta Cloud API)
src/lib/permisos.ts        matriz de roles — la puerta única de autorización
src/acciones/*             server actions del panel (todas verifican permiso)
src/app/reservar           reserva pública
src/app/cita/[token]       gestión de cita por token
src/app/panel/*            panel interno
```

## Reglas de negocio implementadas

1. **Cupos**: salen de `horarios_atencion` + `duracion_cita`, menos citas activas, bloqueos
   y lo que no cumple la anticipación mínima. Se revalidan al guardar (dos personas no pueden
   tomar el mismo horario).
2. **Recordatorios** (todos los tiempos configurables):
   - **R1**: un día antes, dentro de la ventana 08:00–17:00 VET. Siempre, una sola vez.
   - Hora de corte **11:00**:
     - cita **después** del corte → R2 a las 08:00 del día; auto-cancelación 3 h después (11:00).
     - cita **a las 11:00 o antes** → R2 a las 18:00 del día anterior; auto-cancelación a las 21:00.
   - Si ya confirmó, no se le manda nada más. Nunca dos mensajes a la misma cita en el mismo tick.
3. **Cupo liberado** cuando cancela el paciente y en la auto-cancelación por no confirmar.
   **No liberado** en el bloqueo por emergencia: ese rango queda ocupado por el propio bloqueo.
4. **Precios de procedimientos**: solo referencia interna. No aparecen en ninguna página pública.
5. **Deuda**: siempre calculada (cargos − pagos). Nunca se escribe a mano.
6. **Revisiones postop**: al ponerle fecha a una cirugía se programan solas —
   días 7, 14, 21 y 30, a los 3 meses y al año.
7. **Token de gestión**: 40 caracteres aleatorios por cita. Nunca IDs adivinables.
8. **Rate limiting** en reserva (8/hora por IP), gestión de cita (30/10 min) y login (10/10 min).

## Mensajería (WhatsApp)

Único punto con dependencia externa. Hoy está en **modo simulado**: los envíos se registran
en `mensajes_enviados` (visible en Mensajería) pero no salen a WhatsApp ni se cobran.

Para conectarlo cuando Meta apruebe las plantillas:
1. Poner `WHATSAPP_PHONE_ID` y `WHATSAPP_TOKEN` en `.env.local`.
2. En **Mensajería**, cargar el `meta_template_name` aprobado de cada plantilla.
3. En **Configuración**, marcar "Enviar de verdad por WhatsApp".

Cambiar el *texto* de una plantilla exige re-aprobación en Meta; lo que cambia libre son los
datos que rellenan `{{nombre}}`, `{{fecha}}`, `{{hora}}` y `{{link}}`.

**Costo por cita**: mejor caso 1 mensaje (confirma con el R1), peor caso 3 (R1 + R2 + cancelación).
El bloqueo por emergencia suma un mensaje a cada paciente afectado.

## Pruebas

```bash
node scripts/prueba-completa.mjs
```

75 comprobaciones automáticas sobre el sitio en producción: disponibilidad, redirección del
dominio viejo, seguridad (sesiones, tokens, inyección, precios nunca públicos), permisos por
rol, validaciones del formulario, el flujo completo del paciente (reservar → confirmar →
reprogramar → cancelar), límite de peticiones, aritmética del dinero, recordatorios, SEO,
accesibilidad y rendimiento.

Usa pacientes marcados con cédula `V777…` y **los borra al terminar**; no toca datos reales.
Sale con código 1 si algo falla, así que sirve para automatizarlo.

Lo que el script no cubre y hay que mirar en el navegador: las acciones de servidor del panel
(agendar, bloquear, cobrar), los modales del paciente y el comportamiento en teléfono.

## Operación

```bash
cd /home/fenix/marioguerra
npm run db:init          # crea/actualiza la base (idempotente)
npm run build && pm2 restart marioguerra
pm2 logs marioguerra
./scripts/cron-tick.sh   # dispara el tick a mano
```

El cron corre cada 15 minutos: `*/15 * * * * /home/fenix/marioguerra/scripts/cron-tick.sh`
(registro en `data/cron.log`).

**Respaldo**: todo vive en `data/` (base SQLite + archivos subidos). Copiar esa carpeta
con el servicio detenido, o `sqlite3 data/marioguerra.db ".backup respaldo.db"` en caliente.

## Fuera de alcance (por spec)

Landing page (va aparte), Google Calendar, traspaso automático de leads del bot de Mayelis,
agendamiento de cirugías por autoservicio, contabilidad formal, alertas por correo/Telegram,
doble moneda.
