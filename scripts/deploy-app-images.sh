#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE="$SCRIPT_DIR/aiexcel-app-images.tar"
COMPOSE_FILE="${1:-docker-compose.prod.yml}"

command -v docker >/dev/null 2>&1 || { echo 'Docker is not installed.' >&2; exit 1; }
[[ -f "$ARCHIVE" ]] || { echo "Missing $ARCHIVE" >&2; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "Compose file not found: $COMPOSE_FILE" >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1 && [[ -f "$SCRIPT_DIR/SHA256SUMS" ]]; then
  checksum_file="$(mktemp)"
  trap 'rm -f "$checksum_file"' EXIT
  tr -d '\r' < "$SCRIPT_DIR/SHA256SUMS" > "$checksum_file"
  (cd "$SCRIPT_DIR" && sha256sum --check "$checksum_file")
fi

docker compose -f "$COMPOSE_FILE" config --quiet
docker load --input "$ARCHIVE"

docker compose -f "$COMPOSE_FILE" run --rm --no-deps backend \
  npm run prisma:migrate:deploy --workspace backend

docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate backend frontend
docker compose -f "$COMPOSE_FILE" ps backend frontend

echo 'Backend and frontend updated. Other services were not recreated.'
