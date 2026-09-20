#!/usr/bin/env bash
# Revisión de punta a punta del consultorio. Se corre cada 3 horas desde crontab.
# No lleva -e: si un chequeo revienta queremos el informe igual, no un silencio.
set -uo pipefail
export HOME=/home/fenix
export PATH=/usr/local/bin:/usr/bin:/bin
cd /home/fenix/marioguerra
/usr/bin/node scripts/vigilar.mjs
