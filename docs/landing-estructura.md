# Landing de drmarioguerra.com — cómo está armada hoy

Estado al 2026-10-08 (commit `c877c10`, "Landing con movimiento").
Página: `src/app/page.tsx` · Componentes: `src/componentes/landing/` · Estilos: `src/app/globals.css`.

## Identidad que usa

| Elemento | Valor |
|---|---|
| Colores | Petróleo `#061720` (fondo oscuro y texto) · Papel `#f5f1ee` · Nude `#d5c8c8` · Cobre `#7c5943` / cobre claro `#aa7553` |
| Letra | Montserrat (200–700). Títulos en mayúsculas finas con espaciado ancho |
| Logo | Monograma "MG" (`public/marca/monograma*.png`) |
| Regla de oro | **Cero precios en público.** Solo el precio de la consulta aparece en /reservar |

## Orden de las secciones

| # | Sección | Ancla | Qué dice | Componente / fotos |
|---|---|---|---|---|
| 0 | Cabecera fija | — | Logo, menú (Procedimientos, Sobre el Dr., Resultados, Contacto), WhatsApp, Agendar | `CabeceraLanding.tsx` — se esconde al bajar |
| 1 | Hero | `#inicio` | "Cirujano plástico · Maracaibo" / **Dr. Mario Guerra** / "Resultados naturales, en manos expertas." · 2 botones · cifras +8 años, +500, 24/7 | `HeroLanding.tsx` · `hero-modelo.jpg` |
| 2 | Cinta | — | Nombres de los procedimientos pasando | `Cinta.tsx` |
| 3 | Sobre el doctor | `#doctor` | "Un enfoque honesto y cercano" + 2 párrafos | `doctor-retrato.jpg` |
| 4 | Procedimientos | `#procedimientos` | "Qué se puede hacer": 4 categorías (Cuerpo 8, Mamas 5, Rostro 4, No quirúrgico 4) con recuperación y anestesia | `Procedimientos.tsx` |
| 5 | En quirófano | — | "Así trabaja el doctor" | `quirofano-a/b/c.jpg` |
| 6 | Resultados | `#resultados` | "Resultados reales de pacientes reales" → remite a Instagram @DRMARIOGUERRA | (sin fotos de pacientes todavía) |
| 7 | Sí / No | — | Lo que el doctor sí hace (4) y lo que no hace (4) | `SiNo()` en page.tsx |
| 8 | Respaldo | — | +8 años · +500 procedimientos · Certificado | `Contador.tsx` |
| 9 | Testimonios | — | **Oculta** hasta tener testimonios reales | `Testimonios.tsx` |
| 10 | Tu consulta de valoración | — | 4 pasos + financiamiento + botón | `consulta-escritorio.jpg` |
| 11 | Agenda tu consulta / contacto | `#contacto` | Botones, dirección, WhatsApp, emergencias 24/7, redes | — |
| 12 | Pie | — | Menú, redes, aviso "los resultados varían" | — |
| — | Barra fija (teléfono) | — | Agendar consulta + WhatsApp | `BarraMovil.tsx` |

## Procedimientos que se muestran

- **Cuerpo:** Lipoescultura, Abdominoplastia, Mela abdominal, Minidermo, Lipo de papada, Corrección de cicatrices, Recambio de implantes, Reconstrucción genital.
- **Mamas:** Aumento mamario simple, Mastopexia con implantes, Mastopexia sin implantes, Reducción mamaria, Reconstrucción de mamas.
- **Rostro:** Blefaroplastia superior, Blefaroplastia inferior, Otoplastia, Reconstrucción del pabellón auricular.
- **No quirúrgico:** Armonización facial, Toxina botulínica, Ácido hialurónico, Aumento de labios.
- Falta en la landing: **BBL / aumento de glúteos con grasa** (el doctor sí lo hace; falta su categoría y recuperación).

## Datos de contacto que lee de la configuración

- Dirección: Av. 3H entre calle 70 y 71, sector Bella Vista, Maracaibo, Zulia (`config.direccion`).
- WhatsApp del consultorio y de emergencias (`config.whatsapp_consultorio`, `config.whatsapp_emergencias`).
- Redes: Instagram @DRMARIOGUERRA, TikTok @DRMARIOGUERRAOFICIAL, Facebook DR MARIOGUERRA.
- Botón principal → `/reservar` (agenda propia con pago).

## Movimiento que tiene hoy

Titular que sube por ranuras, foto del hero que respira con parallax, cinta de procedimientos,
fotos que se descubren en cortina, contadores, línea de cobre que se llena en los pasos, Sí/No
que se parte, cabecera que se esconde, barra de progreso de lectura. Todo se apaga con
"reducir movimiento" (`Movimiento.tsx` maneja el scroll en un solo escuchador).

## Fotos disponibles (`public/marca/`)

| Archivo | Tamaño | Qué es |
|---|---|---|
| hero-modelo.jpg | 1600×2000 | El doctor con una modelo (hero) |
| doctor-retrato.jpg | 1200×1800 | Retrato del doctor, fondo cálido |
| foto-doctor.jpg | 1100×2114 | Doctor de cuerpo entero |
| consulta-escritorio.jpg | 1200×1500 | Mano con implante sobre el escritorio |
| consulta-implante.jpg | 1200×1500 | Implante en consulta |
| quirofano-a/b/c.jpg | 900×1350 | El doctor operando |
| foto-quirofano.jpg | 1400×661 | Quirófano horizontal |
| foto-reserva-quirofano.jpg | 1400×2100 | Quirófano vertical (fondo de /reservar) |

## Lo que le falta (no es diseño, es material)

1. Fotos de antes y después autorizadas por las pacientes.
2. Testimonios reales (la sección existe pero está oculta).
3. Un video corto del doctor (consulta o quirófano) para el hero.
4. La categoría de glúteos/BBL con su recuperación.
