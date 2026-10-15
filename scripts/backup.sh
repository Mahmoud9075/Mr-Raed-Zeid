#!/usr/bin/env sh
set -eu
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
if [ -n "${DATABASE_URL:-}" ] && echo "$DATABASE_URL" | grep -q '^postgres'; then
  : "${PGHOST:=localhost}" "${PGPORT:=5432}" "${PGDATABASE:=raed}" "${PGUSER:=raed}"
  pg_dump -Fc -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" > "backups/raed-$STAMP.dump"
  echo "Created backups/raed-$STAMP.dump"
else
  cp backend/raed.db "backups/raed-$STAMP.db"
  echo "Created backups/raed-$STAMP.db"
fi
