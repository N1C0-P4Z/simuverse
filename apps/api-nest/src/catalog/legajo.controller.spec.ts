import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LegajoController } from './missing-controllers';
import { PrismaService } from '../prisma/prisma.service';

describe('LegajoController — query param filters', () => {
  let app: INestApplication;
  let prismaMock: Record<string, any>;

  const students = [
    { id: 's1', name: 'Alice', email: 'a@test.com', role: 'student', simulations: [] },
    { id: 's2', name: 'Bob', email: 'b@test.com', role: 'student', simulations: [{ id: 'sim1', status: 'completed', score: 80, progress_percentage: 100 }] },
  ];

  beforeAll(async () => {
    prismaMock = {
      user: {
        findMany: jest.fn().mockResolvedValue(students),
        count: jest.fn().mockResolvedValue(students.length),
      },
      courseTeacher: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      simulationAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegajoController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => { jest.clearAllMocks(); });

  it('returns all students when no query params provided', async () => {
    const res = await request(app.getHttpServer()).get('/legajo/students');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: 'student' },
      }),
    );
  });

  it('filters by course_id when provided', async () => {
    prismaMock.simulationAssignment.findMany.mockResolvedValue([
      { student_id: 's1' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([students[0]]);

    const res = await request(app.getHttpServer()).get('/legajo/students?course_id=course-1');
    expect(res.status).toBe(200);

    // Should have queried simulationAssignments for the course
    expect(prismaMock.simulationAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { course_id: 'course-1' },
        select: { student_id: true },
        distinct: ['student_id'],
      }),
    );
  });

  it('filters by teacher_id through CourseTeacher → SimulationAssignment', async () => {
    prismaMock.courseTeacher.findMany.mockResolvedValue([
      { course_id: 'c1' },
      { course_id: 'c2' },
    ]);
    prismaMock.simulationAssignment.findMany.mockResolvedValue([
      { student_id: 's2' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([students[1]]);

    const res = await request(app.getHttpServer()).get('/legajo/students?teacher_id=t1');
    expect(res.status).toBe(200);

    // Should find courses taught by teacher
    expect(prismaMock.courseTeacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacher_id: 't1' },
        select: { course_id: true },
      }),
    );
  });
});
