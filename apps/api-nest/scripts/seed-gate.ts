/**
 * Seed gate: controla cuándo corre el suite de seeds según RUN_SEEDS y marker DB.
 *
 * Tabla ops `seed_meta` (sin migración Prisma): CREATE TABLE IF NOT EXISTS vía raw SQL.
 * Una fila id=1 indica que el suite ya corrió con éxito.
 *
 * RUN_SEEDS=false (default) → skip
 * RUN_SEEDS=true           → run solo si no hay marker
 * RUN_SEEDS=force          → run siempre (ignora marker)
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

const DEFAULT_SEEDS = [
  'src/prisma/seed.ts',
  'src/prisma/seed-companies.ts',
  'src/prisma/seed-demo.ts',
  'src/prisma/seed-demo-2.ts',
  'src/prisma/seed-demo-3.ts',
  'src/prisma/seed-review.ts',
];

const PROD_SEEDS = [
  'src/prisma/seed.ts',
  'src/prisma/seed-companies.ts',
  'src/prisma/seed-demo.ts',
  'src/prisma/seed-demo-2.ts',
  'src/prisma/seed-demo-3.ts',
];

async function ensureSeedMetaTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seed_meta (
      id int PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function hasMarker(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM seed_meta WHERE id = 1`,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function markDone(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO seed_meta (id, applied_at) VALUES (1, now())
    ON CONFLICT (id) DO UPDATE SET applied_at = now()
  `);
}

function runSeeds(files: string[]): void {
  for (const file of files) {
    console.log(`=== Running ${file} ===`);
    execSync(`npx ts-node ${file}`, { stdio: 'inherit' });
  }
}

function resolveMode(): 'skip' | 'check' | 'force' {
  const raw = (process.env.RUN_SEEDS ?? 'false').toLowerCase().trim();
  if (raw === 'force') return 'force';
  if (raw === 'true' || raw === '1' || raw === 'yes') return 'check';
  return 'skip';
}

function resolveSeedFiles(): string[] {
  const cli = process.argv.slice(2).filter((a) => a.endsWith('.ts'));
  if (cli.length > 0) return cli;
  if (process.env.SEED_SUITE === 'prod') return PROD_SEEDS;
  return DEFAULT_SEEDS;
}

async function main(): Promise<void> {
  const mode = resolveMode();

  if (mode === 'skip') {
    console.log('⏭️  RUN_SEEDS=false — skipping seed suite');
    return;
  }

  const seedFiles = resolveSeedFiles();
  await ensureSeedMetaTable();

  if (mode === 'check' && (await hasMarker())) {
    console.log('⏭️  Seeds already applied (seed_meta marker) — skipping');
    return;
  }

  console.log(`🌱 Running seed suite (RUN_SEEDS=${process.env.RUN_SEEDS ?? 'false'})...`);
  runSeeds(seedFiles);
  await markDone();
  console.log('✅ Seed suite completed — seed_meta marker updated');
}

main()
  .catch((err) => {
    console.error('❌ Seed gate failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
