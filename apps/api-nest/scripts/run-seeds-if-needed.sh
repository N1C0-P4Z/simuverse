#!/bin/sh
# Seed gate wrapper — usa RUN_SEEDS env (false|true|force, default false).
#
# Primera vez (dev):
#   RUN_SEEDS=true docker compose up -d api-nest
# Forzar re-seed:
#   RUN_SEEDS=force docker compose up -d api-nest
#
# Args opcionales: paths .ts relativos a apps/api-nest (override lista default).

set -e

cd "$(dirname "$0")/.." || exit 1

exec npx ts-node scripts/seed-gate.ts "$@"
