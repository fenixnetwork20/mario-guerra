-- Plataforma Dr. Mario Guerra — esquema SQLite
-- Todo el dinero en USD. Todas las fechas/horas en America/Caracas (VET),
-- guardadas como texto 'YYYY-MM-DD HH:MM' o 'YYYY-MM-DD'.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Accesos internos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('recepcion','doctor')),
  activo        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Configuración (clave/valor) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- ── Pacientes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pacientes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  cedula        TEXT NOT NULL UNIQUE,
  whatsapp      TEXT NOT NULL,
  edad          INTEGER,
  notas_medicas TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre ON pacientes(nombre);

-- ── Catálogo de procedimientos (precios de REFERENCIA, nunca públicos) ──────
CREATE TABLE IF NOT EXISTS procedimientos_catalogo (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre            TEXT NOT NULL UNIQUE,
  precio_referencia REAL,
  duracion          TEXT,
  recuperacion      TEXT,
  anestesia         TEXT,
  activo            INTEGER NOT NULL DEFAULT 1,
  orden             INTEGER NOT NULL DEFAULT 0
);

-- ── Horarios de atención ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS horarios_atencion (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo
  hora_inicio TEXT NOT NULL,  -- 'HH:MM'
  hora_fin    TEXT NOT NULL,  -- 'HH:MM'
  activo      INTEGER NOT NULL DEFAULT 1
);

-- ── Citas ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citas (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id           INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('valoracion','cirugia','revision')),
  modalidad             TEXT CHECK (modalidad IN ('presencial','online')),
  fecha_hora            TEXT NOT NULL,       -- 'YYYY-MM-DD HH:MM' (VET)
  duracion              INTEGER NOT NULL DEFAULT 60, -- minutos
  estado                TEXT NOT NULL DEFAULT 'reservada'
                        CHECK (estado IN ('reservada','confirmada','cancelada','reprogramada','completada','no_asistio')),
  origen                TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('link','manual')),
  token_gestion         TEXT NOT NULL UNIQUE,
  motivo_cancelacion    TEXT,
  procedimiento_interes TEXT,
  notas                 TEXT,
  cirugia_id            INTEGER REFERENCES cirugias(id) ON DELETE SET NULL,
  revision_id           INTEGER REFERENCES revisiones_postop(id) ON DELETE SET NULL,
  r1_enviado_at         TEXT,
  r2_enviado_at         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_citas_fecha  ON citas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
CREATE INDEX IF NOT EXISTS idx_citas_pac    ON citas(paciente_id);

-- ── Bloqueos de agenda (emergencias) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bloqueos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  inicio     TEXT NOT NULL,  -- 'YYYY-MM-DD HH:MM'
  fin        TEXT NOT NULL,  -- 'YYYY-MM-DD HH:MM'
  motivo     TEXT,
  created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bloqueos_inicio ON bloqueos(inicio);

-- ── Cirugías ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cirugias (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id     INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  procedimiento   TEXT NOT NULL,
  fecha           TEXT,            -- 'YYYY-MM-DD'
  precio_acordado REAL NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'programada'
                  CHECK (estado IN ('programada','realizada','cancelada')),
  notas           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cirugias_pac ON cirugias(paciente_id);

CREATE TABLE IF NOT EXISTS costos_operacion (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cirugia_id INTEGER NOT NULL REFERENCES cirugias(id) ON DELETE CASCADE,
  concepto   TEXT NOT NULL,
  monto      REAL NOT NULL,
  fecha      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Financiamiento ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planes_financiamiento (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cirugia_id   INTEGER NOT NULL REFERENCES cirugias(id) ON DELETE CASCADE,
  total        REAL NOT NULL,
  inicial      REAL NOT NULL DEFAULT 0,
  meses        INTEGER NOT NULL CHECK (meses IN (1,3,6)),
  fecha_inicio TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cuotas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id           INTEGER NOT NULL REFERENCES planes_financiamiento(id) ON DELETE CASCADE,
  numero            INTEGER NOT NULL,
  monto             REAL NOT NULL,
  fecha_vencimiento TEXT NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada')),
  pago_id           INTEGER REFERENCES pagos(id) ON DELETE SET NULL,
  avisada           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cuotas_venc ON cuotas(fecha_vencimiento);

-- ── Pagos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  cirugia_id  INTEGER REFERENCES cirugias(id) ON DELETE SET NULL,
  cita_id     INTEGER REFERENCES citas(id) ON DELETE SET NULL,
  monto       REAL NOT NULL,
  metodo      TEXT NOT NULL CHECK (metodo IN ('zelle','efectivo','binance')),
  fecha       TEXT NOT NULL,  -- 'YYYY-MM-DD'
  concepto    TEXT,
  created_by  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_pac   ON pagos(paciente_id);

-- ── Cargos del paciente (consultas y otros conceptos facturables) ───────────
CREATE TABLE IF NOT EXISTS cargos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  cirugia_id  INTEGER REFERENCES cirugias(id) ON DELETE CASCADE,
  cita_id     INTEGER REFERENCES citas(id) ON DELETE SET NULL,
  concepto    TEXT NOT NULL,
  monto       REAL NOT NULL,
  fecha       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cargos_pac ON cargos(paciente_id);

-- ── Gastos fijos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos_fijos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  concepto   TEXT NOT NULL,
  categoria  TEXT,
  monto      REAL NOT NULL,
  mes        TEXT NOT NULL,  -- 'YYYY-MM'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gastos_mes ON gastos_fijos(mes);

-- ── Documentos y exámenes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id  INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('examen','documento')),
  nombre       TEXT NOT NULL,
  archivo      TEXT NOT NULL,   -- nombre del fichero en data/uploads
  mime         TEXT,
  tamano       INTEGER,
  fecha        TEXT NOT NULL,
  subido_por   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_pac ON documentos(paciente_id);

-- ── Revisiones postoperatorias ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revisiones_postop (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cirugia_id       INTEGER NOT NULL REFERENCES cirugias(id) ON DELETE CASCADE,
  etiqueta         TEXT NOT NULL,   -- 'mes1-1'..'mes1-4', '3meses', '1ano'
  fecha_programada TEXT NOT NULL,   -- 'YYYY-MM-DD'
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','agendada','completada','omitida'))
);
CREATE INDEX IF NOT EXISTS idx_rev_fecha ON revisiones_postop(fecha_programada);

-- ── Seguimiento ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seguimientos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('comercial','revision')),
  nota        TEXT,
  fecha       TEXT NOT NULL,   -- 'YYYY-MM-DD' en que toca retomar
  estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','hecho','descartado')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seg_fecha ON seguimientos(fecha);

-- ── Mensajería WhatsApp ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plantillas_mensajes (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  clave              TEXT NOT NULL UNIQUE,  -- 'recordatorio_1','recordatorio_2','cancelacion','bloqueo','libre'
  nombre             TEXT NOT NULL,
  meta_template_name TEXT,
  idioma             TEXT NOT NULL DEFAULT 'es',
  variables          TEXT NOT NULL DEFAULT '[]', -- JSON: ["nombre","fecha","hora","link"]
  cuerpo_ejemplo     TEXT,
  activa             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mensajes_enviados (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER REFERENCES pacientes(id) ON DELETE SET NULL,
  cita_id     INTEGER REFERENCES citas(id) ON DELETE SET NULL,
  plantilla   TEXT NOT NULL,
  destino     TEXT NOT NULL,
  variables   TEXT,      -- JSON con los valores usados
  estado      TEXT NOT NULL DEFAULT 'pendiente'
              CHECK (estado IN ('pendiente','enviado','error','simulado')),
  respuesta   TEXT,
  fecha       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_msj_fecha ON mensajes_enviados(fecha);

-- ── Notificaciones internas (campanita) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo    TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  enlace  TEXT,
  leida   INTEGER NOT NULL DEFAULT 0,
  fecha   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_leida ON notificaciones(leida, id DESC);

-- ── Rate limiting de endpoints públicos ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit (
  clave     TEXT PRIMARY KEY,
  contador  INTEGER NOT NULL DEFAULT 0,
  ventana   INTEGER NOT NULL
);

-- Dispositivos que reciben los avisos del panel (web push). Uno por navegador:
-- la misma persona en el teléfono y en la computadora son dos filas.
CREATE TABLE IF NOT EXISTS push_suscripciones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  dispositivo TEXT,
  creada_at   TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_uso  TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_usuario ON push_suscripciones(usuario_id);
