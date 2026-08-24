#!/usr/bin/env bash
set -euo pipefail

# Run from the same directory as docker-compose.prod.yml and .env.production.
if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
fi

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_FILE="kutip-backup-${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

echo "[backup] Dumping ${POSTGRES_DB}..."
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "/tmp/${BACKUP_FILE}"

export RCLONE_CONFIG_SPACES_TYPE=s3
export RCLONE_CONFIG_SPACES_PROVIDER=DigitalOcean
export RCLONE_CONFIG_SPACES_ACCESS_KEY_ID="${SPACES_ACCESS_KEY_ID}"
export RCLONE_CONFIG_SPACES_SECRET_ACCESS_KEY="${SPACES_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_SPACES_ENDPOINT="${SPACES_ENDPOINT}"
export RCLONE_CONFIG_SPACES_REGION="${SPACES_REGION}"

echo "[backup] Uploading to spaces:${SPACES_BUCKET}/backups/..."
rclone copy "/tmp/${BACKUP_FILE}" "spaces:${SPACES_BUCKET}/backups/"
rm "/tmp/${BACKUP_FILE}"

echo "[backup] Pruning backups older than ${RETENTION_DAYS} days..."
rclone delete "spaces:${SPACES_BUCKET}/backups/" --min-age "${RETENTION_DAYS}d"

echo "[backup] Done: ${BACKUP_FILE}"
