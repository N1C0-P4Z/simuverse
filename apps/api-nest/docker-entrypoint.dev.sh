#!/bin/sh
# Dev entrypoint — migraciones siempre; seeds solo con RUN_SEEDS (ver scripts/run-seeds-if-needed.sh).
#
# Primera vez / DB vacía:
#   RUN_SEEDS=true docker compose up -d api-nest
# Re-seed forzado:
#   RUN_SEEDS=force docker compose up -d api-nest
# Restarts normales: RUN_SEEDS=false (default) — no toca seeds ni RBAC.

echo "🔧 Generating Prisma client..."
npx prisma generate || { echo "❌ Prisma generate failed"; exit 1; }

echo "📦 Applying pending migrations..."
npx prisma migrate deploy || echo "⚠️  Migration deploy skipped (may have failed migrations — run 'prisma migrate resolve')"

echo "🌱 Seed gate (RUN_SEEDS=${RUN_SEEDS:-false})..."
sh scripts/run-seeds-if-needed.sh || echo "⚠️  Seed gate failed — continuing startup"

echo "👁️  Starting Prisma file watcher..."
node scripts/watch-prisma.js &

echo "🚀 Starting NestJS in watch mode..."
CHOKIDAR_USEPOLLING=true npx nest start --watch
