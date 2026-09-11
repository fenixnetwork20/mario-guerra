#!/usr/bin/env bash
# Empuja el repositorio al espejo local y, si algún día existe, también a `origin`.
# Pensado para cron: no habla si todo va bien.
#
# Ojo con `set -e`: un `git remote get-url origin && …` que falla porque no hay
# origin hace salir el script con error. Por eso va con `if`, no encadenado.
set -uo pipefail
cd /home/fenix/marioguerra

git push --quiet espejo --all || echo "$(date '+%F %T') · falló el espejo local"

if git remote get-url origin >/dev/null 2>&1; then
  git push --quiet origin --all || echo "$(date '+%F %T') · falló origin"
fi

exit 0
