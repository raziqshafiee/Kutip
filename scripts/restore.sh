#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup-filename>  (e.g. kutip-backup-20260824-030000.sql.gz)"
  echo "List available backups after sourcing .env.production:"
  echo "  rclone lsf spaces:\${SPACES_BUCKET}/backups/"
  exit 1
fi
BACKUP_FILE="$1"

if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
fi

export RCLONE_CONFIG_SPACES_TYPE=s3
export RCLONE_CONFIG_SPACES_PROVIDER=DigitalOcean
export RCLONE_CONFIG_SPACES_ACCESS_KEY_ID="${SPACES_ACCESS_KEY_ID}"
export RCLONE_CONFIG_SPACES_SECRET_ACCESS_KEY="${SPACES_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_SPACES_ENDPOINT="${SPACES_ENDPOINT}"
export RCLONE_CONFIG_SPACES_REGION="${SPACES_REGION}"

echo "[restore] Downloading ${BACKUP_FILE} from spaces:${SPACES_BUCKET}/backups/..."
rclone copy "spaces:${SPACES_BUCKET}/backups/${BACKUP_FILE}" /tmp/

echo "[restore] WARNING: this overwrites the current ${POSTGRES_DB} database."
read -r -p "Type 'restore' to continue: " CONFIRM
if [ "$CONFIRM" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

gunzip -c "/tmp/${BACKUP_FILE}" | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" "${POSTGRES_DB}"
rm "/tmp/${BACKUP_FILE}"

echo "[restore] Done."
