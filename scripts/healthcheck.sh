#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://localhost}"
STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$URL")

if [ "$STATUS" -ge 200 ] && [ "$STATUS" -lt 400 ]; then
  echo "[healthcheck] OK ($STATUS) $URL"
  exit 0
else
  echo "[healthcheck] FAIL ($STATUS) $URL"
  exit 1
fi
