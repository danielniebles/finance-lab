#!/bin/sh
# Usage: ./scripts/db-backup.sh [output-file]
# Default output: backups/financelab-YYYY-MM-DD.sql

mkdir -p backups
OUT=${1:-backups/financelab-$(date +%Y-%m-%d).sql}
docker exec finance-lab-db-1 pg_dump -U financelab financelab > "$OUT"
echo "Backup saved to $OUT"
