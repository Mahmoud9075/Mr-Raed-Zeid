#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
[ -f .env ] || cp .env.example .env
echo "Starting Mr. Raed Full-Stack Platform..."
docker compose up --build -d
echo "Site: http://localhost"
echo "Admin login uses ADMIN_EMAIL and ADMIN_PASSWORD from .env"
