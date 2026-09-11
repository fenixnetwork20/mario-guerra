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

### El banco de fotos del cliente (2026-09-10)

13 fotos en `branding/fotos-20260910/` (llegaron en `/root/mario guerra/fotos de mario.zip`).
Lo que se usó y por qué:

| Foto | Dónde | Por qué |
|---|---|---|
| `13` | `doctor-retrato.jpg` — Sobre el doctor | Fondo marrón cálido: es el mismo cobre de la marca |
| `92` | `consulta-implante.jpg` — La consulta | Él explicando en su escritorio, sin ningún paciente expuesto |
| `89`, `IMG_6652`, `IMG_6667` | `quirofano-a/b/c.jpg` — Resultados | Operando, sin pacientes identificables |
| `IMG_6667` | `foto-reserva-quirofano.jpg` — /reservar | La pidió el cliente |
| `106` | `hero-modelo.jpg` — portada de la landing | La pidió el cliente; es una **modelo** de su sesión, no una paciente |

**Las que NO se publican, y no es descuido:**
- `IMG_6671` — quirófano con **la cara de la paciente visible**. Mismo motivo.
- `96` — la tablet muestra el torso de una paciente.
- `IMG_6948`, `IMG_6953`, `IMG_6955`, `24`, `94` — buenas, sin usar. Reserva para cambios.

> **El encuadre de la portada es un parámetro, no una constante.** `HeroLanding` recibe
> `encuadre`: una vertical con dos personas no se recorta como un retrato suelto. Con el
> valor por defecto, esta foto entraba entrando por el torso y con las dos cabezas cortadas.
> Hoy: `object-[45%_10%] lg:object-[50%_2%]`, que deja las dos caras dentro.

### Lo que falta cargar (y dónde)

| Qué | Dónde | Estado |
|---|---|---|
| Más fotos del doctor | arreglo `fotos` del `<HeroLanding>` en `src/app/page.tsx` | Con una sola foto el crossfade se queda quieto; al agregar entradas arranca solo |
| Testimonios reales | constante `TESTIMONIOS` en `src/app/page.tsx` | Vacía a propósito. La sección no se dibuja mientras no haya ninguno: **no se inventan reseñas de pacientes** |
| Galería de resultados | sección `#resultados` | Hoy solo enlaza al perfil de Instagram. El feed embebido real necesita token de Meta o un servicio externo |
| Imágenes de categorías | cards de `Procedimientos` | Hoy son tipográficas; el componente acepta imagen sin rehacer nada |

## `/reservar`: el menú guiado

La página de reserva es **un solo cuadro** con tres caminos, y un paso por pantalla. El
paciente nunca ve el formulario completo de golpe: eso es lo que hace que la gente
abandone. Todo vive en `src/componentes/AsistenteCitas.tsx`.

| Camino | Pasos |
|---|---|
| **Agendar mi cita** | día → hora → modalidad → datos → resumen (5 pasos; los tres primeros avanzan solos al tocar) |
| **Confirmar mi cita** | cédula → su cita → "Sí, voy a asistir" → confirmación (solo si ya toca, ver abajo) |
| **Cancelar o reprogramar** | cédula → su cita → reprogramar (entra al paso 1 con sus datos) o cancelar |

Los enlaces privados `/cita/{token}` que ya se enviaron **siguen funcionando igual**: son
el otro camino a lo mismo, no un reemplazo.

### Aspecto: vidrio sobre el retrato

La tarjeta **no es blanca**: es petróleo translúcido (`.vidrio`, `backdrop-filter`) sobre el
retrato del doctor desenfocado. El blanco puro contra la foto se veía barato y dejaba los tres
botones indistinguibles entre sí.

- **Cómo se cambia la foto de fondo**: se suelta un archivo **con nombre nuevo** en
  `public/marca/`, empezando por `foto-reserva` (`foto-reserva-loquesea.jpg`), y se reinicia.
  La página toma sola la más reciente de `public/marca/foto-reserva*`. Hoy es
  `foto-reserva-quirofano.jpg` (la `IMG_6667.jpeg` del envío del cliente), 1400 px, 318 KB.
- **El nombre nuevo no es capricho, es la caché.** `/_next/image` sirve con
  `max-age=14400`: si se sobrescribe el mismo archivo, quien ya entró sigue viendo la foto
  vieja durante cuatro horas —y parece que el cambio "no se aplicó"—. Y no se puede forzar
  con `?v=`: el optimizador de Next responde **400** a cualquier ruta local con query. Por eso
  la versión va en el nombre del archivo. Los originales de ese
  envío están en `branding/fotos-20260910/` (13 archivos).
- **`overflow-hidden` en el contenedor de la foto no es decorativo**: la imagen lleva
  `scale-105` y sin recorte se derramaba 27 px por el borde derecho, dibujando una franja
  cálida vertical en mitad del fondo. Además el borde se disuelve con `mask-image`.
- El velo de abajo cierra en petróleo **sólido**, no al 80 %: con una foto de fondo claro
  —las de traje sobre gris— el texto de "Qué pasa en tu consulta" quedaba encima de una zona
  clara y se perdía. Así el pie aguanta cualquier foto que se ponga.
- El alto está medido: en una pantalla de 667 px el tercer botón entraba justo por debajo del
  pliegue. Por eso el `[@media(max-height:730px)]:pt-8` y los textos cortos del menú. Si se
  alarga una de esas tres líneas, hay que volver a medirlo.
- En escritorio el retrato ocupa la mitad izquierda y la tarjeta se corre a la derecha. Un
  retrato vertical estirado a lo ancho de una pantalla se convierte en un primerísimo plano
  deformado: por eso el contenedor de la imagen se recorta con `lg:right-[38%]`.
- Clases nuevas en `globals.css`: `.vidrio`, `.opcion` / `.opcion-activa`, `.campo-oscuro`,
  `.btn-cobre`, `.btn-vidrio`, `.btn-peligro-vidrio`. **El cobre es el único color lleno de
  toda la tarjeta**: donde está el cobre es donde hay que tocar.
- `.campo-oscuro option` necesita color propio: el desplegable nativo abre en blanco.

> **`backdrop-filter` ancla los `position: fixed` de adentro.** Igual que el `transform` de
> `<Aparece>`. Por eso los dos diálogos de confirmación se dibujan con `createPortal` en el
> `<body>`; metidos dentro de la tarjeta salían mal colocados o directamente invisibles.

### Confirmar solo cuando toca

**La confirmación no se ofrece al reservar.** Se abre desde el momento en que pudo salir el
primer recordatorio —el día anterior, `r1Desde`— y hasta entonces el paciente ve *"Todavía no
tienes que hacer nada"*. Confirmar al reservar no prueba nada y encima apaga el R2 y la
auto-cancelación dos semanas antes, que es justo lo que sostiene la agenda.

- La puerta es `confirmacionAbierta(fechaHora)` en `src/lib/recordatorios.ts`, y la aplica el
  **servidor** (`POST /api/publico/cita/{token}` responde 409), no solo la interfaz.
- Una cita tomada para hoy o para mañana temprano **ya nace dentro de la ventana**: `r1Desde`
  ya pasó. Así nadie queda sin poder confirmar antes de la auto-cancelación.
- Reprogramar y cancelar están disponibles siempre, desde el minuto uno.
- El enlace de los recordatorios R1 y R2 lleva `?confirmar=1`: abre el diálogo de confirmación
  de una vez, con los datos ya cargados. Un toque desde el WhatsApp y listo.

> El diálogo se dibuja con `createPortal` en el `<body>`. Vive dentro de un `<Aparece>`, y
> mientras ese bloque no se ha revelado tiene `opacity: 0` y un `transform` —que además le
> roba el anclaje a `position: fixed`—. Metido ahí dentro, el enlace del recordatorio abría
> un diálogo invisible.

### La búsqueda por cédula

`POST /api/publico/buscar-cita` es lo que hace posible confirmar o cancelar sin tener el
enlace privado a mano. **Pide solo la cédula** — decisión del consultorio, tomada sabiendo
que en Venezuela la cédula es casi pública y que quien la sepa puede ver y cancelar la cita
de otro. Todo lo que se puede endurecer sin pedirle un dato más al paciente, está puesto:

- 5 intentos por IP cada 10 minutos;
- **la misma respuesta** para "cédula mal escrita" y para "no tiene cita", así no sirve
  para averiguar si una cédula tiene cita;
- devuelve fecha, hora, modalidad y estado. **Nunca** el nombre, el teléfono ni el
  procedimiento de interés — ese es el dato sensible, y es el que un tercero no puede ver;
- solo consultas de valoración: cirugías y revisiones postop las mueve el consultorio.

> Si algún día se quiere cerrar del todo, el cambio es de un campo: pedir también los
> **últimos 4 dígitos del WhatsApp**. La lógica ya está aislada en esa ruta.

### Trampa ya resuelta

Reprogramar navega de `/reservar` a `/reservar?desde=TOKEN`. Es la misma ruta, así que
React **conserva el estado** del componente cliente y el paciente se queda mirando la
pantalla anterior. Por eso `page.tsx` le pasa `key={desde ?? 'menu'}` al asistente: fuerza
el remontaje. Sin esa `key` el flujo de reprogramación se ve roto sin que nada falle.

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

## Orden de la landing (2026-09-10)

El problema era el blanco: cinco bloques claros seguidos, y dos de ellos **vacíos** —
"Resultados" era un titular y una tarjeta suelta en media pantalla en blanco, y
"Financiamiento" era una sección entera para tres líneas de texto.

Qué se hizo:
- **Resultados pasó a módulo oscuro** con una banda de tres fotos de quirófano (dos en móvil)
  y la tarjeta de Instagram sobre vidrio. Donde había vacío ahora hay trabajo del doctor.
- **Financiamiento desapareció como sección**: su texto cierra el bloque de "La consulta",
  que es donde el paciente lo necesita.
- Fotos nuevas en "Sobre el doctor" (retrato de estudio) y "La consulta" (él con el implante,
  en su escritorio) en lugar de las dos fotos de bata que se repetían.

El ritmo queda: oscuro (portada) · claro (doctor) · claro (procedimientos) · **oscuro
(resultados)** · partido (sí/no) · oscuro (respaldo) · claro (consulta) · oscuro (contacto).

> El mapa de contacto es `loading="lazy"` y tarda unos segundos: en una captura rápida sale
> como un recuadro en blanco y parece roto. No lo está — comprobado con la red del navegador.

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
src/app/reservar           menú guiado: agendar, confirmar, cancelar/reprogramar
src/componentes/AsistenteCitas.tsx   los tres caminos, un paso por pantalla
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
   - El paciente **solo puede confirmar desde `r1Desde`**: la confirmación pertenece al
     recordatorio, no a la reserva. Ver "Confirmar solo cuando toca".
3. **Cupo liberado** cuando cancela el paciente y en la auto-cancelación por no confirmar.
   **No liberado** en el bloqueo por emergencia: ese rango queda ocupado por el propio bloqueo.
4. **Precios de procedimientos**: solo referencia interna. No aparecen en ninguna página pública.
5. **Deuda**: siempre calculada (cargos − pagos). Nunca se escribe a mano.
6. **Revisiones postop**: al ponerle fecha a una cirugía se programan solas —
   días 7, 14, 21 y 30, a los 3 meses y al año.
7. **Token de gestión**: 40 caracteres aleatorios por cita. Nunca IDs adivinables.
8. **Teléfonos**: venezolanos como los escribe cualquiera (`04…`, `584…`, `4…`) y extranjeros
   **con el `+` y su código de país**. El `+` no es un capricho: diez dígitos sueltos son
   indistinguibles de un móvil venezolano y `normalizarTelefono()` los convertiría en un
   número venezolano inexistente. La consulta online se ofrece a quien está fuera del país,
   así que el formulario tiene que aceptarlos — antes rechazaba un `+57` colombiano.
8. **Rate limiting** en reserva (8/hora por IP), gestión de cita (30/10 min) y login (10/10 min).

## Mensajería (WhatsApp)

Único punto con dependencia externa. Hoy está en **modo simulado**: los envíos se registran
en `mensajes_enviados` (visible en Mensajería) pero no salen a WhatsApp ni se cobran.

**El número ya está conectado** (2026-09-10): `+1 832-593-0835`, Cloud API por *embedded
signup* desde odichat, inbox **85** de la cuenta 11.

| Dato | Valor |
|---|---|
| `phone_number_id` | `1220400801167668` |
| WABA | `1774692996896546` — "Dr Mario Guerra", dentro del negocio Fenix Flow ai |
| Revisión de la cuenta | APPROVED |
| Verificación del negocio | **pending_submission** → tope de 250 conversaciones iniciadas por día |

Ya están en `.env.local` el `WHATSAPP_PHONE_ID` y el `WHATSAPP_TOKEN`, y en la base los seis
`meta_template_name`. **Falta un solo paso**: en Configuración marcar "Enviar de verdad por
WhatsApp" — y antes, que Meta apruebe las plantillas.

### Las seis plantillas en Meta

`mg_reserva_recibida`, `mg_recordatorio_1`, `mg_recordatorio_2`, `mg_cancelacion_aviso`,
`mg_bloqueo`, `mg_manual`. Todas UTILITY, idioma `es`, cuerpo con cuatro variables en este
orden: nombre, fecha, hora, enlace.

> **Meta recategoriza sola, y después no se puede deshacer.** La primera plantilla de
> cancelación decía "Puedes tomar otro horario aquí" y Meta la aprobó como **MARKETING**:
> invitar a agendar algo nuevo no es el aviso de una cita que ya existe. La categoría de una
> plantilla aprobada **no se puede cambiar** (`Cannot update an approved template category`),
> así que hubo que crear otra —`mg_cancelacion_aviso`— que solo informa y remite a la ficha de
> la cita, donde vive el botón de reagendar. Regla para las próximas: un aviso informa, no
> ofrece. La vieja `mg_cancelacion` queda para borrar cuando la nueva esté aprobada.

> **La regla que rompía las plantillas viejas**: Meta no acepta un cuerpo que empiece o
> termine en variable. Las cinco originales cerraban con `{{link}}` y habrían sido
> rechazadas. Las seis nuevas llevan una frase después del enlace.

> **El +1 832-593-0835 es el número de atención al cliente**, confirmado por el consultorio.
> Reemplazó al `04129086272` en toda la web, en el pie, en la ayuda de /reservar y en el
> prompt del bot. El `04246502649` sigue siendo el del doctor para emergencias, y ese sí es
> venezolano. `normalizarTelefono()` resuelve bien los dos formatos; lo que no puede adivinar
> son diez dígitos sueltos sin código de país: asume Venezuela.

> La app le habla a Meta **directamente** por la Graph API, no a través de odichat. Lo que
> manda el sistema no aparece en el hilo de Chatwoot: el registro está en Mensajería.

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

## Respaldos

**Automático, todas las noches a las 3:20 de Maracaibo** (`scripts/respaldar.sh`, en el cron).

Guarda tres cosas en un solo archivo cifrado con AES-256, y las tres hacen falta:

| | Por qué |
|---|---|
| La base SQLite | pacientes, citas, dinero, historial |
| `data/uploads/` | los exámenes y documentos médicos — restaurar la base sin ellos deja fichas que apuntan a la nada |
| `.env.local` | los secretos. Sin el `CRON_TOKEN` los recordatorios dejan de dispararse, y ahí irán las credenciales de WhatsApp |

Va cifrado porque adentro hay cédulas, teléfonos y datos médicos. La passphrase es la
compartida del VPS: `/home/fenix/backups/.backup-passphrase` — **guárdala aparte, sin ella no
hay restauración posible.**

Rotación: 14 diarios, 8 semanales, 12 mensuales, en `/home/fenix/respaldos/marioguerra/`.

**El respaldo se verifica solo.** Después de crearlo lo descifra, lo desempaqueta y comprueba
que tenga las 22 tablas, al menos un usuario y el `SESSION_SECRET` adentro. Si algo falta,
borra el archivo y anota el fallo en vez de dejar un respaldo vacío que da falsa tranquilidad.

```bash
./scripts/respaldar.sh            # respalda, verifica y rota
./scripts/respaldar.sh --listar   # ver lo guardado
```

### Restaurar

```bash
ULTIMO=$(ls -1t /home/fenix/respaldos/marioguerra/diario/*.gpg | head -1)
mkdir -p /tmp/restaurar && cd /tmp/restaurar
gpg -d --batch --passphrase-file /home/fenix/backups/.backup-passphrase "$ULTIMO" | tar -xzf -

# Comprobar ANTES de pisar nada
sqlite3 marioguerra.db "PRAGMA integrity_check; SELECT COUNT(*) FROM pacientes;"

pm2 stop marioguerra
cp marioguerra.db  /home/fenix/marioguerra/data/marioguerra.db
cp -a uploads/.    /home/fenix/marioguerra/data/uploads/
cp env.local.txt   /home/fenix/marioguerra/.env.local   # solo si se perdieron los secretos
pm2 start marioguerra
```

*(Este procedimiento se probó de verdad el 2026-09-09: la base restauró íntegra, con la ficha
del paciente legible y las dos cuentas de acceso intactas.)*

### Código

El repositorio vive en `/home/fenix/marioguerra`. Tiene un **espejo local** en
`/home/fenix/backups-git/marioguerra.git` (remoto `espejo`), que se actualiza solo con el cron
de las 7:40 vía `scripts/espejo-git.sh`. **Eso protege de un borrado o de un mal cambio, no de
que se muera el servidor**: sigue estando todo en la misma máquina.

Falta el remoto de verdad. Las llaves de despliegue ya están generadas en el VPS
(`~/.ssh/marioguerra` para el código, `~/.ssh/marioguerra-respaldos` para los respaldos) y
`~/.ssh/config` ya tiene los alias `github-marioguerra` y `github-marioguerra-respaldos`.
GitHub todavía no las reconoce, así que faltan los dos repos privados y pegar cada llave
pública en *Settings → Deploy keys* con permiso de escritura. Cuando estén:

```bash
git remote add origin github-marioguerra:USUARIO/marioguerra.git
git push -u origin master
```

Desde ahí, `scripts/espejo-git.sh` empuja a los dos solo.

**Nunca entran al repositorio**: `.env.local` y cualquier `.env.local.bak-*` (llevan el token
de WhatsApp), `data/` (base con datos de pacientes), y `branding/fotos-20260910/` — los 147 MB
de originales de la sesión de fotos, que están en el Drive del cliente y en
`/root/mario guerra/`. Al repositorio solo van las versiones optimizadas de `public/marca/`.
Los exportes con credenciales (respaldos del workflow de N8N, copias del entorno) viven fuera,
en `/home/fenix/respaldos/marioguerra/exportes/`.

Repositorio git en el proyecto, con espejo en `/home/fenix/backups-git/marioguerra.git`.
La base, los documentos y `.env.local` **no** van en git a propósito: su copia es el respaldo
cifrado de arriba.

> ⚠️ **Todo esto sigue viviendo en el mismo VPS.** Protege contra un borrado accidental, un
> despliegue malo o una tabla corrupta — no contra perder el servidor. Falta una copia fuera.

## Fuera de alcance (por spec)

Landing page (va aparte), Google Calendar, traspaso automático de leads del bot de Mayelis,
agendamiento de cirugías por autoservicio, contabilidad formal, alertas por correo/Telegram,
doble moneda.
