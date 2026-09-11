#!/usr/bin/env bash
#
# Respaldo diario del consultorio. Guarda DOS cosas y las dos hacen falta:
#   · la base SQLite —pacientes, citas, dinero, historial—
#   · data/uploads/ —los exámenes y documentos médicos que sube el consultorio.
#     Restaurar la base sin los archivos deja fichas que apuntan a la nada.
#   · .env.local —los secretos. Sin el CRON_TOKEN los recordatorios dejan de
#     dispararse, y ahí van también las credenciales de WhatsApp cuando entren.
#     No van en git a propósito; su copia es esta.
#
# Se cifra con AES-256 (misma passphrase que el resto del VPS) porque adentro
# hay cédulas, teléfonos y datos médicos.
#
# Se VERIFICA que el respaldo se pueda descifrar y que tenga las tablas y las
# filas adentro antes de darlo por bueno. Un respaldo vacío es peor que
# ninguno: da la sensación de estar cubierto.
#
#   ./scripts/respaldar.sh            respalda, verifica y rota
#   ./scripts/respaldar.sh --listar   muestra lo que hay guardado
#
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="/home/fenix/respaldos/marioguerra"
REGISTRO="$DESTINO/respaldos.log"
PASS="/home/fenix/backups/.backup-passphrase"
BASE="$RAIZ/data/marioguerra.db"
SUBIDOS="$RAIZ/data/uploads"

DIARIOS=14
SEMANALES=8
MENSUALES=12

export TZ=America/Caracas
anotar() { echo "$(date '+%Y-%m-%d %H:%M:%S') · $*" >> "$REGISTRO"; }

if [ "${1:-}" = "--listar" ]; then
  for c in diario semanal mensual; do
    echo "── $c"
    ls -lh "$DESTINO/$c" 2>/dev/null | tail -n +2 | awk '{print "   " $9 "  " $5}' || echo "   (vacío)"
  done
  exit 0
fi

[ -f "$PASS" ] || { echo "falta la passphrase en $PASS"; exit 1; }
[ -f "$BASE" ] || { echo "no está la base en $BASE"; exit 1; }
mkdir -p "$DESTINO"/{diario,semanal,mensual}

SELLO="$(date +%Y-%m-%d_%H%M)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

anotar "arranca"

# Copia en caliente: .backup es seguro con la app escribiendo (WAL incluido).
sqlite3 "$BASE" ".backup '$TMP/marioguerra.db'"
mkdir -p "$TMP/uploads"
[ -d "$SUBIDOS" ] && cp -a "$SUBIDOS/." "$TMP/uploads/" 2>/dev/null || true
cp "$RAIZ/.env.local" "$TMP/env.local.txt" 2>/dev/null || true

ARCHIVO="$DESTINO/diario/marioguerra_${SELLO}.tar.gz.gpg"
tar -czf - -C "$TMP" marioguerra.db uploads env.local.txt \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "$PASS" -o "$ARCHIVO"

# ── Que el respaldo SIRVA, no solo que exista ──────────────────────────────
PRUEBA="$TMP/verificacion"; mkdir -p "$PRUEBA"
if ! gpg -d --batch --quiet --passphrase-file "$PASS" "$ARCHIVO" 2>/dev/null | tar -xzf - -C "$PRUEBA"; then
  anotar "FALLO: el respaldo no se pudo descifrar o desempaquetar"
  rm -f "$ARCHIVO"; exit 1
fi
tablas=$(sqlite3 "$PRUEBA/marioguerra.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table'" 2>/dev/null || echo 0)
pacientes=$(sqlite3 "$PRUEBA/marioguerra.db" "SELECT COUNT(*) FROM pacientes" 2>/dev/null || echo -1)
usuarios=$(sqlite3 "$PRUEBA/marioguerra.db" "SELECT COUNT(*) FROM usuarios" 2>/dev/null || echo 0)
archivos=$(find "$PRUEBA/uploads" -type f 2>/dev/null | wc -l)
secreto=$(grep -c 'SESSION_SECRET' "$PRUEBA/env.local.txt" 2>/dev/null || echo 0)

if [ "$tablas" -lt 18 ] || [ "$usuarios" -lt 1 ] || [ "$pacientes" -lt 0 ] || [ "$secreto" -lt 1 ]; then
  anotar "FALLO: respaldo incompleto (tablas=$tablas usuarios=$usuarios pacientes=$pacientes secretos=$secreto)"
  rm -f "$ARCHIVO"; exit 1
fi

PESO=$(stat -c %s "$ARCHIVO")
anotar "ok · $(basename "$ARCHIVO") · ${PESO} bytes · ${tablas} tablas, ${pacientes} pacientes, ${archivos} documentos"

# ── Copias semanal y mensual ───────────────────────────────────────────────
if [ "$(date +%u)" = "7" ]; then cp "$ARCHIVO" "$DESTINO/semanal/"; anotar "copia semanal"; fi
if [ "$(date +%d)" = "01" ]; then cp "$ARCHIVO" "$DESTINO/mensual/"; anotar "copia mensual"; fi

# ── Rotación ───────────────────────────────────────────────────────────────
# Con la carpeta vacía el glob no expande y `ls` sale con error: sin el
# `|| true` eso mataba el script entero por culpa de set -e.
podar() {
  local carpeta="$1" cuantos="$2"
  { ls -1t "$carpeta"/marioguerra_*.tar.gz.gpg 2>/dev/null || true; } \
    | tail -n +$((cuantos + 1)) | xargs -r rm -f
}
podar "$DESTINO/diario" "$DIARIOS"
podar "$DESTINO/semanal" "$SEMANALES"
podar "$DESTINO/mensual" "$MENSUALES"

# ── Copia fuera del servidor ───────────────────────────────────────────────
# Un respaldo que solo vive en la máquina que respalda no es un respaldo. Sube
# los .gpg a GitHub; la passphrase se queda aquí, así que allá son ruido.
# Va después de la rotación para que el repositorio refleje lo que quedó, y
# nunca hace caer el script: si GitHub no responde, el respaldo local ya está
# hecho y verificado, que es lo que de verdad importa.
subir_afuera() {
  local repo="$DESTINO"
  git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || { anotar "sin repositorio de respaldos"; return 0; }
  git -C "$repo" add -A >/dev/null 2>&1 || true
  if git -C "$repo" diff --cached --quiet 2>/dev/null; then
    anotar "sin cambios que subir"
    return 0
  fi
  git -C "$repo" commit -q -m "Respaldo $SELLO" >/dev/null 2>&1 || true
  if git -C "$repo" remote get-url origin >/dev/null 2>&1; then
    if git -C "$repo" push -q origin HEAD 2>/dev/null; then
      anotar "subido a GitHub"
    else
      anotar "NO se pudo subir a GitHub (el respaldo local sí quedó)"
    fi
  else
    anotar "commit local · falta el remoto de GitHub"
  fi
}
subir_afuera

echo "$(date -Iseconds) respaldo ok → $ARCHIVO (${PESO} bytes, ${pacientes} pacientes, ${archivos} documentos)"
