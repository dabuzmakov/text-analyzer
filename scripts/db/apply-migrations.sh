#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed"
  exit 1
fi

MIGRATIONS_DIR="${MIGRATIONS_DIR:-database/migrations}"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

echo "Preparing schema_migrations table..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);"

for file in "$MIGRATIONS_DIR"/*.sql; do
  [[ -e "$file" ]] || continue
  filename="$(basename "$file")"

  already_applied="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT 1 FROM schema_migrations WHERE filename = '$filename' LIMIT 1;")"
  if [[ "$already_applied" == "1" ]]; then
    echo "Skipping already applied migration: $filename"
    continue
  fi

  echo "Applying migration: $filename"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename) VALUES ('$filename');"
done

echo "Migration process completed."
