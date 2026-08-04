import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherSessionsController } from './teacher-sessions.controller';

describe('TeacherSessionsController', () => {
  let controller: TeacherSessionsController;
  let prismaMock: Record<string, any>;

  const teacherUser = { id: 'teacher-1', role: 'teacher' };
  const adminUser = { id: 'admin-1', role: 'admin' };

  beforeEach(async () => {
    prismaMock = {
      teacherGroup: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      simulationInstance: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      simulationChatLog: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      fileUpload: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeacherSessionsController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    controller = module.get(TeacherSessionsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('returns empty envelope when teacher has no students in TeacherGroup', async () => {
      prismaMock.teacherGroup.findMany.mockResolvedValue([]);

      const result = await controller.list(teacherUser);

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
      expect(prismaMock.simulationInstance.findMany).not.toHaveBeenCalled();
    });

    it('restricts teacher to TeacherGroup student ids', async () => {
      prismaMock.teacherGroup.findMany.mockResolvedValue([
        { student_id: 'student-a' },
        { student_id: 'student-b' },
      ]);
      prismaMock.simulationInstance.findMany.mockResolvedValue([]);
      prismaMock.simulationInstance.count.mockResolvedValue(0);
      prismaMock.simulationChatLog.count.mockResolvedValue(0);

      await controller.list(teacherUser, 'course-1');

      expect(prismaMock.simulationInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            course_id: 'course-1',
            student_id: { in: ['student-a', 'student-b'] },
            student: { role: 'student' },
          },
        }),
      );
    });

    it('throws when teacher requests a student outside their group', async () => {
      prismaMock.teacherGroup.findMany.mockResolvedValue([
        { student_id: 'student-a' },
      ]);

      await expect(
        controller.list(teacherUser, undefined, 'student-x'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to list all sessions with optional filters', async () => {
      prismaMock.simulationInstance.findMany.mockResolvedValue([
        {
          id: 'inst-1',
          status: 'completed',
          score: 80,
          started_at: new Date('2026-07-14T10:00:00Z'),
          completed_at: new Date('2026-07-14T11:00:00Z'),
          progress_percentage: 100,
          student_id: 'student-a',
          course_id: 'course-1',
          student: { id: 'student-a', name: 'Ana', email: 'ana@test.com' },
          course: { id: 'course-1', title: 'Curso 1' },
          scenario: {
            id: 'sc-1',
            title: 'Práctica 1',
            scenario_type: 'practice',
            difficulty: 'medium',
            agent_key: 'agent-practice-1',
            sequence_index: 1,
          },
        },
      ]);
      prismaMock.simulationInstance.count.mockResolvedValue(1);
      prismaMock.simulationChatLog.count.mockResolvedValue(5);

      const result = await controller.list(adminUser, 'course-1', 'student-a');

      expect(prismaMock.teacherGroup.findMany).not.toHaveBeenCalled();
      expect(prismaMock.simulationInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { course_id: 'course-1', student_id: 'student-a', student: { role: 'student' } },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'inst-1',
        agent_key: 'agent-practice-1',
        total_turns: 5,
        student_name: 'Ana',
      });
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('detail', () => {
    const baseInstance = {
      id: 'inst-1',
      status: 'completed',
      score: 80,
      started_at: new Date('2026-07-14T10:00:00Z'),
      completed_at: new Date('2026-07-14T11:00:00Z'),
      progress_percentage: 100,
      practice_summary: 'Resumen',
      student_id: 'student-a',
      student: { id: 'student-a', name: 'Ana', email: 'ana@test.com' },
      course: { id: 'course-1', title: 'Curso 1' },
      scenario: {
        id: 'sc-1',
        title: 'Práctica 1',
        scenario_type: 'practice',
        difficulty: 'medium',
        agent_key: 'agent-practice-1',
      },
    };

    it('throws NotFoundException when session does not exist', async () => {
      prismaMock.simulationInstance.findUnique.mockResolvedValue(null);

      await expect(controller.detail('missing', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when teacher views session for student outside TeacherGroup', async () => {
      prismaMock.simulationInstance.findUnique.mockResolvedValue(baseInstance);
      prismaMock.teacherGroup.findFirst.mockResolvedValue(null);

      await expect(controller.detail('inst-1', teacherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns logs grouped and sorted by hour', async () => {
      prismaMock.simulationInstance.findUnique.mockResolvedValue(baseInstance);
      prismaMock.simulationChatLog.findMany.mockResolvedValue([
        {
          id: 2,
          turn_number: 2,
          speaker: 'ai',
          message: 'Respuesta IA',
          is_correct: null,
          ref_number: null,
          created_at: new Date('2026-07-14T12:30:00Z'),
        },
        {
          id: 1,
          turn_number: 1,
          speaker: 'student',
          message: 'Hola',
          is_correct: null,
          ref_number: null,
          created_at: new Date('2026-07-14T10:15:00Z'),
        },
      ]);

      const result = await controller.detail('inst-1', adminUser);

      expect(result.logs_by_hour).toHaveLength(2);
      expect(result.logs_by_hour[0].hour).toBe('2026-07-14T10:00');
      expect(result.logs_by_hour[1].hour).toBe('2026-07-14T12:00');
      expect(result.instance.agent_key).toBe('agent-practice-1');
      expect(result.summary.total_turns).toBe(2);
    });
  });
});
