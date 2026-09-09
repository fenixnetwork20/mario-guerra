#!/usr/bin/env bash
# Recordatorios y auto-cancelaciones. Se corre cada 15 minutos desde crontab.
set -euo pipefail
cd /home/fenix/marioguerra
TOKEN=$(grep -E '^CRON_TOKEN=' .env.local | cut -d= -f2-)
BASE=$(grep -E '^NEXT_PUBLIC_BASE_PATH=' .env.local | cut -d= -f2- || true)
curl -fsS "http://127.0.0.1:3320${BASE}/api/cron/tick?token=${TOKEN}" \
  >> /home/fenix/marioguerra/data/cron.log 2>&1 \
  || echo "$(date -Is) falló el tick" >> /home/fenix/marioguerra/data/cron.log
