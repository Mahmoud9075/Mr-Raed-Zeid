#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and set unique production secrets first." >&2
  exit 1
fi
echo "Starting Mr. Raed Full-Stack Platform..."
docker compose up --build -d
echo "Site: http://localhost"
echo "Admin login uses ADMIN_EMAIL and ADMIN_PASSWORD from .env"
