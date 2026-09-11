# Respaldos cifrados · Consultorio Dr. Mario Guerra

Espejo, dentro del repositorio, de los respaldos que genera
`/home/fenix/marioguerra/scripts/respaldar.sh` todas las madrugadas a las 7:20.

Cada `.gpg` lleva adentro la base SQLite completa (pacientes, citas, dinero,
historial), los documentos médicos de `data/uploads/` y el `.env.local` con los
secretos. Está cifrado con AES-256.

**La passphrase no está aquí ni puede estarlo.** Vive solo en el VPS, en
`/home/fenix/backups/.backup-passphrase`. Sin ella estos archivos son ruido — que
es justamente lo que hace que se puedan guardar en un repositorio.

Esta carpeta es un espejo: la copia viva está en `/home/fenix/respaldos/marioguerra`
y `respaldar.sh` la sincroniza aquí al terminar. Retención: 14 diarios, 8
semanales, 12 mensuales. La rotación borra los viejos de la carpeta, pero el
historial de git los conserva.

Aquí **solo entran `.gpg`**. El `.gitignore` del proyecto bloquea cualquier otra
cosa dentro de `respaldos/` para que un descuido no publique nada legible.

## Restaurar

```bash
gpg --batch --passphrase-file /home/fenix/backups/.backup-passphrase \
    -d marioguerra_2026-09-10_0320.tar.gz.gpg | tar xz
```

Salen `marioguerra.db`, `uploads/` y `env.local.txt`. El procedimiento completo,
con las comprobaciones que hay que hacer antes de pisar la base buena, está en el
README del proyecto, sección *Restaurar*.
