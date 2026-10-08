#!/bin/sh
# Copy production data (Supabase, `public` schema only) into the local Docker DB.
#
# Usage: ./scripts/db-pull-prod.sh [--keep-chat]
#
# Production is only READ (pg_dump takes a consistent snapshot). The local DB is
# backed up first, then its `public` schema is replaced. ChatMessage and
# PendingProposal are emptied afterwards unless --keep-chat is passed (private
# conversation history; not needed for most testing).
#
# pg_dump runs in a throwaway postgres:17 container: Supabase is Postgres 17, and
# an older pg_dump refuses to dump a newer server. Nothing to install locally.

set -eu

KEEP_CHAT=0
[ "${1:-}" = "--keep-chat" ] && KEEP_CHAT=1

DB_CONTAINER=finance-lab-db-1
STAMP=$(date +%Y-%m-%d_%H%M%S)
DUMP=backups/prod-public-$STAMP.sql
LOCAL_BACKUP=backups/local-pre-prod-pull-$STAMP.sql

env_value() { # env_value <file> <key> — value of KEY=... without printing it
  grep -E "^$2=" "$1" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

PROD_URL=$(env_value .env DIRECT_URL)
LOCAL_URL=$(env_value .env.local DATABASE_URL)

# Guards: the source must be Supabase and the target must be local, never the
# other way round.
case "$PROD_URL" in
  *supabase.com*) ;;
  *) echo "Refusing: DIRECT_URL in .env is not a Supabase URL." >&2; exit 1 ;;
esac
case "$LOCAL_URL" in
  *@localhost:*|*@127.0.0.1:*) ;;
  *) echo "Refusing: DATABASE_URL in .env.local is not localhost." >&2; exit 1 ;;
esac
docker exec "$DB_CONTAINER" pg_isready -U financelab >/dev/null || {
  echo "Local DB container $DB_CONTAINER is not ready (docker compose up -d db)." >&2; exit 1
}

mkdir -p backups

echo "1/5 Backing up local DB → $LOCAL_BACKUP"
docker exec "$DB_CONTAINER" pg_dump -U financelab financelab > "$LOCAL_BACKUP"

echo "2/5 Dumping production (public schema, read-only) → $DUMP"
docker run --rm -e PGURL="$PROD_URL" postgres:17-alpine \
  sh -c 'pg_dump "$PGURL" --schema=public --no-owner --no-privileges --no-comments' > "$DUMP"
grep -q '_prisma_migrations' "$DUMP" || { echo "Dump looks wrong (no _prisma_migrations). Local DB untouched." >&2; exit 1; }

echo "3/5 Replacing local public schema"
if grep -q '^CREATE SCHEMA public;' "$DUMP"; then
  RESET='DROP SCHEMA public CASCADE;'
else
  RESET='DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
fi
{
  echo "$RESET"
  cat "$DUMP"
} | docker exec -i "$DB_CONTAINER" psql -q -U financelab financelab -v ON_ERROR_STOP=1 >/dev/null

if [ "$KEEP_CHAT" -eq 0 ]; then
  echo "4/5 Emptying ChatMessage and PendingProposal"
  docker exec "$DB_CONTAINER" psql -q -U financelab financelab -c 'TRUNCATE "ChatMessage", "PendingProposal";'
else
  echo "4/5 Keeping chat history (--keep-chat)"
fi

echo "5/5 Row counts"
docker exec "$DB_CONTAINER" psql -U financelab financelab -tA -F ' ' -c "
  SELECT 'Transaction', count(*) FROM \"Transaction\"
  UNION ALL SELECT 'Installment', count(*) FROM \"Installment\"
  UNION ALL SELECT 'Loan', count(*) FROM \"Loan\"
  UNION ALL SELECT 'Vault', count(*) FROM \"Vault\";"
docker exec "$DB_CONTAINER" psql -U financelab financelab -tA -c   "SELECT 'latest migration: ' || max(migration_name) FROM _prisma_migrations;"

echo "Done. To go back to the previous local data:"
echo "  docker exec $DB_CONTAINER psql -U financelab financelab -c 'DROP SCHEMA public CASCADE;'"
echo "  ./scripts/db-restore.sh $LOCAL_BACKUP"
