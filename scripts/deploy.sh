#!/usr/bin/env bash
set -euo pipefail

# The single correct entrypoint for building/starting/managing the production
# stack. Always use this instead of calling `docker compose -f
# docker-compose.prod.yml` directly.
#
# Docker Compose's ${VAR} interpolation (used for build.args in
# docker-compose.prod.yml, so app/worker/migrate build with real
# NEXT_PUBLIC_* values instead of empty ones) only reads a literal .env file
# or an explicit --env-file flag -- it never reads env_file:-referenced
# files. Since this stack's only source of truth is .env.production, running
# a plain `docker compose -f docker-compose.prod.yml up -d --build` silently
# builds broken images. This script always passes --env-file so that mistake
# isn't possible.
#
# Usage: ./scripts/deploy.sh <any docker compose subcommand and args>
#   ./scripts/deploy.sh up -d --build
#   ./scripts/deploy.sh ps
#   ./scripts/deploy.sh logs -f app
#   ./scripts/deploy.sh down

if [ ! -f .env.production ]; then
  echo "Error: .env.production not found in the current directory." >&2
  echo "Copy .env.production.example to .env.production and fill in real values first." >&2
  exit 1
fi

exec docker compose --env-file .env.production -f docker-compose.prod.yml "$@"
