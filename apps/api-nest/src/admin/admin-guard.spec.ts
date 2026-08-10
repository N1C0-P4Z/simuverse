import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Force JWT fallback in test environment (Firebase not configured in Docker)
process.env.AUTH_TEST_MODE = 'jwt';

function signToken(payload: { sub: string; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

describe('RBAC Guard Wiring (e2e)', () => {
  let app: INestApplication;
  let prismaMock: Record<string, any>;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  beforeAll(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      course: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      simulation: {
        count: jest.fn(),
      },
      scenario: {
        count: jest.fn(),
      },
      assessment: {
        count: jest.fn(),
      },
      role: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      systemFunctionality: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rolePermission: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      teacherGroup: {
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      sessionRubricReview: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    adminToken = signToken({ sub: 'admin-id', email: 'admin@test.com', role: 'admin' });
    teacherToken = signToken({ sub: 'teacher-id', email: 'teacher@test.com', role: 'teacher' });
    studentToken = signToken({ sub: 'student-id', email: 'student@test.com', role: 'student' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockImplementation(({ where }) => {
      const users: Record<string, any> = {
        'admin-id': { id: 'admin-id', name: 'Admin', email: 'admin@test.com', role: 'admin', password_hash: '$2b$10$hashed', created_at: new Date(), updated_at: new Date() },
        'teacher-id': { id: 'teacher-id', name: 'Teacher', email: 'teacher@test.com', role: 'teacher', password_hash: '$2b$10$hashed', created_at: new Date(), updated_at: new Date() },
        'student-id': { id: 'student-id', name: 'Student', email: 'student@test.com', role: 'student', password_hash: '$2b$10$hashed', created_at: new Date(), updated_at: new Date() },
      };
      return Promise.resolve(users[where.id] || null);
    });
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.teacherGroup.findMany.mockResolvedValue([]);
  });

  // ─── Admin routes: unauthenticated → 401 ────────────────────────────

  describe('Unauthenticated access (no token)', () => {
    it('GET /api/admin/stats → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/stats')
        .expect(401);
    });

    it('GET /api/admin/roles → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/roles')
        .expect(401);
    });

    it('GET /api/global-stats → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/global-stats')
        .expect(401);
    });

    it('GET /api/teacher-groups → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/teacher-groups')
        .expect(401);
    });
  });

  // ─── Admin routes: student → 403 ────────────────────────────────────

  describe('Student access to admin routes (403)', () => {
    it('GET /api/admin/stats → 403', async () => {
      prismaMock.user.count.mockResolvedValue(0);
      prismaMock.course.count.mockResolvedValue(0);
      prismaMock.simulation.count.mockResolvedValue(0);
      prismaMock.scenario.count.mockResolvedValue(0);
      prismaMock.assessment.count.mockResolvedValue(0);
      prismaMock.user.groupBy.mockResolvedValue([]);
      prismaMock.course.groupBy.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('GET /api/admin/roles → 403', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('POST /api/admin/roles → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'test' })
        .expect(403);
    });

    it('GET /api/global-stats → 403', async () => {
      await request(app.getHttpServer())
        .get('/api/global-stats')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('GET /api/teacher-groups → 403', async () => {
      await request(app.getHttpServer())
        .get('/api/teacher-groups')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  // ─── Admin routes: admin → 200 ──────────────────────────────────────

  describe('Admin access to admin routes (200)', () => {
    it('GET /api/admin/stats → 200', async () => {
      prismaMock.user.count.mockResolvedValue(10);
      prismaMock.course.count.mockResolvedValue(5);
      prismaMock.simulation.count.mockResolvedValue(20);
      prismaMock.simulation.count.mockResolvedValueOnce(20).mockResolvedValueOnce(3);
      prismaMock.scenario.count.mockResolvedValue(15);
      prismaMock.assessment.count.mockResolvedValue(8);
      prismaMock.user.groupBy.mockResolvedValue([{ role: 'student', _count: { id: 10 } }]);
      prismaMock.course.groupBy.mockResolvedValue([{ category: 'admin', _count: { id: 5 } }]);

      await request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /api/admin/roles → 200', async () => {
      prismaMock.role.findMany.mockResolvedValue([
        { id: 1, name: 'admin', description: 'Admin', is_active: true },
      ]);

      await request(app.getHttpServer())
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /api/admin/teacher-permissions → 200', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/teacher-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /api/global-stats → 200', async () => {
      prismaMock.user.groupBy.mockResolvedValue([
        { role: 'student', _count: { _all: 10 } },
        { role: 'teacher', _count: { _all: 2 } },
      ]);
      prismaMock.sessionRubricReview.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);
      prismaMock.sessionRubricReview.findMany
        .mockResolvedValueOnce([{ total_score: 80, max_score: 100 }])
        .mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/api/global-stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total_evaluations).toBe(5);
      expect(res.body.users).toEqual([
        { role: 'student', count: 10 },
        { role: 'teacher', count: 2 },
      ]);
      expect(
        res.body.users.every((u: { count: unknown }) => typeof u.count === 'number'),
      ).toBe(true);
    });

    it('GET /api/global-stats → 200 with zero review stats when reviews table missing', async () => {
      prismaMock.user.groupBy.mockResolvedValue([
        { role: 'admin', _count: { _all: 1 } },
      ]);
      prismaMock.sessionRubricReview.count.mockRejectedValue(
        new Error('relation "session_rubric_reviews" does not exist'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/global-stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.users).toEqual([{ role: 'admin', count: 1 }]);
      expect(res.body.total_evaluations).toBe(0);
      expect(res.body.top_courses).toEqual([]);
      expect(res.body.top_students).toEqual([]);
    });

    it('GET /api/teacher-groups → 200', async () => {
      prismaMock.teacherGroup.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/teacher-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // ─── Teacher access to teacher-groups ────────────────────────────────

  describe('Teacher access to teacher-groups (200)', () => {
    it('GET /api/teacher-groups → 200', async () => {
      prismaMock.teacherGroup.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/teacher-groups')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
    });
  });

  // ─── Teacher cannot access admin-only routes ────────────────────────

  describe('Teacher access to admin-only routes (403)', () => {
    it('GET /api/admin/stats → 403', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });

    it('GET /api/global-stats → 403', async () => {
      await request(app.getHttpServer())
        .get('/api/global-stats')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });
  });

  // ─── RBAC dedup verification ────────────────────────────────────────

  describe('RBAC delegation via AdminService', () => {
    it('GET /api/admin/roles delegates to RbacService.listRoles', async () => {
      prismaMock.role.findMany.mockResolvedValue([
        { id: 1, name: 'admin', description: 'Admin', is_active: true },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(prismaMock.role.findMany).toHaveBeenCalled();
    });

    it('POST /api/admin/roles delegates to RbacService.createRole', async () => {
      prismaMock.role.create.mockResolvedValue({
        id: 2, name: 'editor', description: 'Editor', is_active: true,
      });

      const res = await request(app.getHttpServer())
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'editor', description: 'Editor' })
        .expect(201);

      expect(res.body).toHaveProperty('name', 'editor');
      expect(prismaMock.role.create).toHaveBeenCalled();
    });
  });
});
