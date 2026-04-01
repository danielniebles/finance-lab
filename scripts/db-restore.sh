#!/bin/sh
# Usage: ./scripts/db-restore.sh <backup-file>

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

docker exec -i finance-lab-db-1 psql -U financelab financelab < "$1"
echo "Restored from $1"
