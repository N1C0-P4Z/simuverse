// LOCAL ONLY — never run against production
// docker compose exec api-nest npx ts-node src/prisma/seed-pagination-demo.ts --local-only
// or from apps/api-nest: npx ts-node src/prisma/seed-pagination-demo.ts --local-only

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const RECORD_COUNT = 28;
const PAG_PREFIX = '[PAG]';
const DEMO_COURSE_TITLE = `${PAG_PREFIX} Demo Course`;
const DEMO_COURSE_CODE = 'PAG-DEMO-001';

type SeedCounts = Record<string, { created: number; skipped: number; total: number }>;

function assertLocalOnly(): void {
  const hasLocalOnlyFlag = process.argv.includes('--local-only');
  const nodeEnv = process.env.NODE_ENV ?? '';
  const isDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';

  if (!hasLocalOnlyFlag && !isDevOrTest) {
    console.error(
      '❌ Refusing to run: pass --local-only or set NODE_ENV=development|test.',
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl) {
    console.error('❌ Refusing to run: DATABASE_URL is not set.');
    process.exit(1);
  }

  const lower = dbUrl.toLowerCase();
  const isLocalHost =
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('@postgres:') ||
    lower.includes('@db:');

  const looksProduction =
    lower.includes('prod') ||
    lower.includes('railway') ||
    lower.includes('amazonaws');

  if (looksProduction && !isLocalHost) {
    console.error(
      '❌ Refusing to run: DATABASE_URL looks like production (prod/railway/amazonaws without localhost).',
    );
    process.exit(1);
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function initCounts(): SeedCounts {
  return {};
}

function bump(
  counts: SeedCounts,
  entity: string,
  created: boolean,
): void {
  if (!counts[entity]) {
    counts[entity] = { created: 0, skipped: 0, total: 0 };
  }
  if (created) counts[entity].created += 1;
  else counts[entity].skipped += 1;
  counts[entity].total += 1;
}

async function getOrCreateDemoCourse(): Promise<{ id: string; course_id: string }> {
  const existing = await prisma.course.findFirst({
    where: { title: DEMO_COURSE_TITLE },
    select: { id: true, course_id: true },
  });
  if (existing) return existing;

  const id = 'pag-demo-course-001';
  const course = await prisma.course.create({
    data: {
      id,
      course_id: DEMO_COURSE_CODE,
      title: DEMO_COURSE_TITLE,
      description: 'Curso de prueba local para demo de paginación',
      category: 'pag-demo',
      is_active: true,
    },
    select: { id: true, course_id: true },
  });
  return course;
}

async function getAssignedByUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { id: true },
  });
  if (admin) return admin.id;

  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  if (!anyUser) {
    throw new Error('No users in DB — run main seed first (admin@simuverse.edu).');
  }
  return anyUser.id;
}

async function seedUsers(
  passwordHash: string,
  counts: SeedCounts,
): Promise<string[]> {
  const studentIds: string[] = [];

  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const email = `pag.student.${nn}@demo.local`;
    const name = `${PAG_PREFIX} Student ${nn}`;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      studentIds.push(existing.id);
      bump(counts, 'User', false);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        id: `pag-student-${nn}`,
        email,
        name,
        password_hash: passwordHash,
        role: 'student',
      },
    });
    studentIds.push(user.id);
    bump(counts, 'User', true);
  }

  return studentIds;
}

async function seedSponsors(counts: SeedCounts): Promise<void> {
  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const name = `${PAG_PREFIX} Sponsor ${nn}`;

    const existing = await prisma.sponsor.findFirst({ where: { name } });
    if (existing) {
      bump(counts, 'Sponsor', false);
      continue;
    }

    await prisma.sponsor.create({
      data: {
        name,
        logo_url: `https://picsum.photos/seed/pag-sponsor-${nn}/200/200`,
        is_active: true,
      },
    });
    bump(counts, 'Sponsor', true);
  }
}

async function seedEndorsers(counts: SeedCounts): Promise<void> {
  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const name = `${PAG_PREFIX} Endorser ${nn}`;

    const existing = await prisma.endorser.findFirst({ where: { name } });
    if (existing) {
      bump(counts, 'Endorser', false);
      continue;
    }

    await prisma.endorser.create({
      data: {
        name,
        short_name: `PAG-END-${nn}`,
        is_active: true,
      },
    });
    bump(counts, 'Endorser', true);
  }
}

async function seedFoundationConfigs(counts: SeedCounts): Promise<void> {
  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const name = `${PAG_PREFIX} Foundation ${nn}`;

    const existing = await prisma.foundationConfig.findFirst({ where: { name } });
    if (existing) {
      bump(counts, 'FoundationConfig', false);
      continue;
    }

    await prisma.foundationConfig.create({
      data: {
        name,
        short_name: `PAG-FND-${nn}`,
        is_active: true,
      },
    });
    bump(counts, 'FoundationConfig', true);
  }
}

async function seedSimulatedCompanies(counts: SeedCounts): Promise<void> {
  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const name = `${PAG_PREFIX} Company ${nn}`;

    const existing = await prisma.simulatedCompany.findUnique({ where: { name } });
    if (existing) {
      bump(counts, 'SimulatedCompany', false);
      continue;
    }

    await prisma.simulatedCompany.create({
      data: {
        name,
        short_name: `PAG-CO-${nn}`,
        description: 'Empresa simulada para demo de paginación local',
        is_fictional: true,
        is_active: true,
      },
    });
    bump(counts, 'SimulatedCompany', true);
  }
}

async function seedCategories(counts: SeedCounts): Promise<void> {
  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const name = `${PAG_PREFIX} Category ${nn}`;
    const code = `PAG_CAT_${nn}`;

    const existing = await prisma.category.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) {
      bump(counts, 'Category', false);
      continue;
    }

    await prisma.category.create({
      data: {
        name,
        code,
        description: 'Categoría de demo para paginación',
        is_active: true,
      },
    });
    bump(counts, 'Category', true);
  }
}

async function seedCourseDocuments(
  courseId: string,
  counts: SeedCounts,
): Promise<void> {
  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const document_name = `${PAG_PREFIX} Document ${nn}`;

    const existing = await prisma.courseDocument.findFirst({
      where: { course_id: courseId, document_name },
    });
    if (existing) {
      bump(counts, 'CourseDocument', false);
      continue;
    }

    await prisma.courseDocument.create({
      data: {
        course_id: courseId,
        document_name,
        document_type: 'other',
        document_content: `Contenido de prueba para paginación — documento ${nn}.`,
        is_active: true,
      },
    });
    bump(counts, 'CourseDocument', true);
  }
}

async function seedTechSheets(
  courseId: string,
  counts: SeedCounts,
): Promise<void> {
  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const name = `${PAG_PREFIX} TechSheet ${nn}`;

    const existing = await prisma.techSheet.findFirst({
      where: { course_id: courseId, name },
    });
    if (existing) {
      bump(counts, 'TechSheet', false);
      continue;
    }

    await prisma.techSheet.create({
      data: {
        name,
        course_id: courseId,
        ministry_code: `PAG-TS-${nn}`,
        description: 'Ficha técnica de demo para paginación',
        processed: false,
      },
    });
    bump(counts, 'TechSheet', true);
  }
}

async function seedScenarios(
  courseId: string,
  counts: SeedCounts,
): Promise<string[]> {
  const scenarioIds: string[] = [];

  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const title = `${PAG_PREFIX} Scenario ${nn}`;
    const id = `pag-scenario-${nn}`;

    const existing = await prisma.scenario.findFirst({
      where: { course_id: courseId, title },
    });
    if (existing) {
      scenarioIds.push(existing.id);
      bump(counts, 'Scenario', false);
      continue;
    }

    const scenario = await prisma.scenario.create({
      data: {
        id,
        course_id: courseId,
        title,
        description: `Escenario de demo para paginación #${nn}`,
        scenario_type: 'practice',
        difficulty: 'medium',
        sequence_index: i,
        is_active: true,
      },
    });
    scenarioIds.push(scenario.id);
    bump(counts, 'Scenario', true);
  }

  return scenarioIds;
}

async function seedAssignments(
  courseId: string,
  studentIds: string[],
  assignedBy: string,
  counts: SeedCounts,
): Promise<void> {
  for (let i = 1; i <= RECORD_COUNT; i++) {
    const nn = pad(i);
    const studentId = studentIds[i - 1];
    const simulationId = `pag-simulation-${nn}`;

    let simulation = await prisma.simulation.findUnique({
      where: { id: simulationId },
    });
    if (!simulation) {
      simulation = await prisma.simulation.create({
        data: {
          id: simulationId,
          student_id: studentId,
          course_id: courseId,
          status: 'active',
        },
      });
    }

    const existingAssignment = await prisma.simulationAssignment.findFirst({
      where: {
        student_id: studentId,
        course_id: courseId,
        simulation_id: simulation.id,
      },
    });
    if (existingAssignment) {
      bump(counts, 'SimulationAssignment', false);
      continue;
    }

    await prisma.simulationAssignment.create({
      data: {
        simulation_id: simulation.id,
        student_id: studentId,
        course_id: courseId,
        assigned_by: assignedBy,
        status: 'pending',
        max_attempts: 1,
        attempts_used: 0,
      },
    });
    bump(counts, 'SimulationAssignment', true);
  }
}

function printSummary(counts: SeedCounts): void {
  console.log('\n── Pagination demo seed summary ──');
  for (const [entity, stats] of Object.entries(counts)) {
    console.log(
      `  ${entity}: ${stats.created} created, ${stats.skipped} skipped (${stats.total} total)`,
    );
  }

  console.log('\n── How to delete demo data ──');
  console.log('  Users:                DELETE FROM users WHERE email LIKE \'pag.student.%@demo.local\';');
  console.log('  Sponsors:             DELETE FROM sponsors WHERE name LIKE \'[PAG]%\';');
  console.log('  Endorsers:            DELETE FROM endorsers WHERE name LIKE \'[PAG]%\';');
  console.log('  Foundation configs:   DELETE FROM foundation_config WHERE name LIKE \'[PAG]%\';');
  console.log('  Simulated companies:  DELETE FROM simulated_companies WHERE name LIKE \'[PAG]%\';');
  console.log('  Categories:           DELETE FROM categories WHERE name LIKE \'[PAG]%\';');
  console.log('  Course documents:     DELETE FROM course_documents WHERE document_name LIKE \'[PAG]%\';');
  console.log('  Tech sheets:          DELETE FROM tech_sheets WHERE name LIKE \'[PAG]%\';');
  console.log('  Scenarios:            DELETE FROM scenarios WHERE title LIKE \'[PAG]%\';');
  console.log('  Simulations:          DELETE FROM simulations WHERE id LIKE \'pag-simulation-%\';');
  console.log('  Assignments:          DELETE FROM simulation_assignments WHERE simulation_id LIKE \'pag-simulation-%\';');
  console.log('  Demo course:          DELETE FROM courses WHERE title = \'[PAG] Demo Course\';');
  console.log('\n  Or generic: DELETE FROM <table> WHERE name LIKE \'[PAG]%\' (where applicable).');
}

async function main(): Promise<void> {
  assertLocalOnly();

  console.log(`🌱 Seeding ~${RECORD_COUNT} [PAG] records per entity (local only)...`);

  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const counts = initCounts();

  const demoCourse = await getOrCreateDemoCourse();
  console.log(`📚 Demo course: "${DEMO_COURSE_TITLE}" (${demoCourse.id})`);

  const assignedBy = await getAssignedByUserId();

  const studentIds = await seedUsers(passwordHash, counts);
  await seedSponsors(counts);
  await seedEndorsers(counts);
  await seedFoundationConfigs(counts);
  await seedSimulatedCompanies(counts);
  await seedCategories(counts);
  await seedCourseDocuments(demoCourse.id, counts);
  await seedTechSheets(demoCourse.id, counts);
  await seedScenarios(demoCourse.id, counts);
  await seedAssignments(demoCourse.id, studentIds, assignedBy, counts);

  printSummary(counts);
  console.log('\n✅ Pagination demo seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
