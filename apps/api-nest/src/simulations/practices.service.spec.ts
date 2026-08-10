import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PracticesService } from './practices.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from './ai/ai.service';
import { SessionMemoryService } from './session-memory.service';
import { SessionCheckpointService } from './session-checkpoint.service';

describe('PracticesService', () => {
  let service: PracticesService;
  let prismaMock: Record<string, any>;
  let aiMock: { sendMessage: jest.Mock };
  let sessionMemoryMock: {
    getHistory: jest.Mock;
    getRecentTurns: jest.Mock;
    invalidate: jest.Mock;
  };
  let checkpointMock: {
    hydrateSession: jest.Mock;
    startPeriodicCheckpoint: jest.Mock;
    checkpointAndClose: jest.Mock;
  };

  const courseId = 'course-1';
  const studentId = 'student-1';

  const practices = [
    {
      id: 'p1',
      course_id: courseId,
      title: 'Práctica 1',
      sequence_index: 1,
      agent_key: 'practica-1',
      difficulty: 'very_low',
      scenario_type: 'practice',
      is_active: true,
      prior_context: null,
    },
    {
      id: 'p2',
      course_id: courseId,
      title: 'Práctica 2',
      sequence_index: 2,
      agent_key: 'practica-2',
      difficulty: 'low',
      scenario_type: 'practice',
      is_active: true,
      prior_context: null,
    },
  ];

  beforeEach(async () => {
    prismaMock = {
      course: { findUnique: jest.fn() },
      scenario: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      simulationInstance: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    aiMock = { sendMessage: jest.fn() };
    sessionMemoryMock = {
      getHistory: jest.fn().mockResolvedValue([
        { speaker: 'student', message: 'Hola' },
        { speaker: 'ai', message: 'Bienvenido' },
      ]),
      getRecentTurns: jest.fn().mockReturnValue([
        { speaker: 'student', message: 'Hola' },
        { speaker: 'ai', message: 'Bienvenido' },
      ]),
      invalidate: jest.fn(),
    };
    checkpointMock = {
      hydrateSession: jest.fn(),
      startPeriodicCheckpoint: jest.fn(),
      checkpointAndClose: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AIService, useValue: aiMock },
        { provide: SessionMemoryService, useValue: sessionMemoryMock },
        { provide: SessionCheckpointService, useValue: checkpointMock },
      ],
    }).compile();

    service = module.get(PracticesService);
  });

  describe('listByCourse', () => {
    it('returns explicit practice scenarios when present', async () => {
      prismaMock.scenario.findMany.mockResolvedValueOnce(practices);

      const result = await service.listByCourse(courseId);

      expect(prismaMock.scenario.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].agent_key).toBe('practica-1');
    });

    it('falls back to all active scenarios when no explicit practices exist', async () => {
      const legacy = [
        {
          id: 'legacy-1',
          course_id: courseId,
          title: 'Primer Día',
          sequence_index: 1,
          agent_key: null,
          scenario_type: 'daily_operations',
          is_active: true,
        },
      ];
      prismaMock.scenario.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(legacy);

      const result = await service.listByCourse(courseId);

      expect(prismaMock.scenario.findMany).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0].agent_key).toBe('practica-1');
    });

    it('assigns agent_key from sequence when missing on legacy scenarios', async () => {
      const legacy = [
        {
          id: 'legacy-2',
          course_id: courseId,
          title: 'Segunda práctica',
          sequence_index: 2,
          agent_key: null,
          scenario_type: 'quality_control',
          is_active: true,
        },
      ];
      prismaMock.scenario.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(legacy);

      const result = await service.listByCourse(courseId);

      expect(result[0].agent_key).toBe('practica-2');
    });
  });

  describe('listByCoursePaginated', () => {
    it('returns envelope with skip/take for explicit practices', async () => {
      prismaMock.scenario.count = jest.fn().mockResolvedValueOnce(2);
      prismaMock.scenario.findMany.mockResolvedValueOnce([practices[0]]);

      const result = await service.listByCoursePaginated(courseId, 1, 1);

      expect(result).toEqual({
        data: [expect.objectContaining({ id: 'p1', agent_key: 'practica-1' })],
        total: 2,
        page: 1,
        limit: 1,
      });
      expect(prismaMock.scenario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 1 }),
      );
    });
  });

  describe('createPractice', () => {
    it('auto-assigns sequence_index and agent_key', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: courseId });
      prismaMock.scenario.findFirst.mockResolvedValue({
        sequence_index: 2,
      });
      prismaMock.scenario.create.mockResolvedValue({
        id: 'p3',
        sequence_index: 3,
        agent_key: 'practica-3',
      });

      const result = await service.createPractice(courseId, {
        title: 'Nueva',
        difficulty: 'medium',
      });

      expect(prismaMock.scenario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sequence_index: 3,
            agent_key: 'practica-3',
            scenario_type: 'practice',
            difficulty: 'medium',
          }),
        }),
      );
      expect(result.agent_key).toBe('practica-3');
    });
  });

  describe('getStudentProgress', () => {
    it('marks only first practice as unlocked when none completed', async () => {
      prismaMock.scenario.findMany.mockResolvedValue(practices);
      prismaMock.simulationInstance.findMany.mockResolvedValue([]);

      const progress = await service.getStudentProgress(studentId, courseId);

      expect(progress.practices[0].status).toBe('available');
      expect(progress.practices[0].unlocked).toBe(true);
      expect(progress.practices[1].status).toBe('locked');
      expect(progress.practices[1].unlocked).toBe(false);
      expect(progress.next_practice_id).toBe('p1');
    });

    it('unlocks next practice after previous is completed', async () => {
      prismaMock.scenario.findMany.mockResolvedValue(practices);
      prismaMock.simulationInstance.findMany.mockResolvedValue([
        {
          scenario_id: 'p1',
          status: 'completed',
          id: 'inst-1',
          started_at: new Date(),
        },
      ]);

      const progress = await service.getStudentProgress(studentId, courseId);

      expect(progress.practices[0].status).toBe('completed');
      expect(progress.practices[1].status).toBe('available');
      expect(progress.next_practice_id).toBe('p2');
      expect(progress.completed_count).toBe(1);
    });
  });

  describe('startNextPractice', () => {
    beforeEach(() => {
      prismaMock.scenario.findMany.mockResolvedValue(practices);
      prismaMock.simulationInstance.findMany.mockResolvedValue([]);
      prismaMock.simulationInstance.findFirst.mockResolvedValue(null);
      prismaMock.simulationInstance.create.mockResolvedValue({
        id: 'inst-new',
        student_id: studentId,
        scenario_id: 'p1',
        status: 'in_progress',
      });
    });

    it('starts first unlocked practice', async () => {
      const result = await service.startNextPractice(studentId, courseId);

      expect(result.practice.id).toBe('p1');
      expect(result.resumed).toBe(false);
      expect(checkpointMock.startPeriodicCheckpoint).toHaveBeenCalledWith('inst-new');
    });

    it('rejects locked practice by id', async () => {
      await expect(
        service.startNextPractice(studentId, courseId, 'p2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('injects prior_context from previous practice summary', async () => {
      prismaMock.simulationInstance.findMany.mockResolvedValue([
        { scenario_id: 'p1', status: 'completed' },
      ]);
      prismaMock.simulationInstance.findFirst.mockImplementation(({ where }) => {
        if (where.scenario_id === 'p2' && where.status?.in) {
          return Promise.resolve(null);
        }
        if (where.scenario_id === 'p1') {
          return Promise.resolve({
            practice_summary: 'El alumno resolvió el caso de liquidación.',
          });
        }
        return Promise.resolve(null);
      });
      prismaMock.simulationInstance.create.mockResolvedValue({
        id: 'inst-p2',
        student_id: studentId,
        scenario_id: 'p2',
        status: 'in_progress',
      });

      const result = await service.startNextPractice(studentId, courseId, 'p2');

      expect(result.prior_context).toBe('El alumno resolvió el caso de liquidación.');
      expect(prismaMock.simulationInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            session_state: {
              prior_context: 'El alumno resolvió el caso de liquidación.',
            },
          }),
        }),
      );
    });
  });

  describe('completePractice', () => {
    it('summarizes transcript and stores practice_summary', async () => {
      prismaMock.scenario.findMany.mockResolvedValue(practices);
      prismaMock.simulationInstance.findMany.mockResolvedValue([
        { scenario_id: 'p1' },
        { scenario_id: 'p2' },
      ]);
      prismaMock.simulationInstance.findUnique.mockResolvedValue({
        id: 'inst-1',
        student_id: studentId,
        course_id: courseId,
        scenario: practices[0],
      });
      aiMock.sendMessage.mockResolvedValue({
        response: 'Resumen de la sesión sin calificación.',
      });
      prismaMock.simulationInstance.update.mockResolvedValue({
        id: 'inst-1',
        status: 'completed',
        practice_summary: 'Resumen de la sesión sin calificación.',
      });

      const result = await service.completePractice(studentId, 'inst-1');

      expect(aiMock.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Sin calificar ni puntuar'),
        expect.any(String),
      );
      expect(prismaMock.simulationInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            practice_summary: 'Resumen de la sesión sin calificación.',
            status: 'completed',
          }),
        }),
      );
      expect(result.summary).toBe('Resumen de la sesión sin calificación.');
      expect(result.all_completed).toBe(true);
      expect(sessionMemoryMock.invalidate).toHaveBeenCalledWith('inst-1');
    });

    it('should write encore_summary to session_state on complete', async () => {
      prismaMock.scenario.findMany.mockResolvedValue(practices);
      prismaMock.simulationInstance.findMany.mockResolvedValue([
        { scenario_id: 'p1' },
      ]);
      prismaMock.simulationInstance.findUnique.mockResolvedValue({
        id: 'inst-1',
        student_id: studentId,
        course_id: courseId,
        scenario: practices[0],
        session_state: { prior_context: 'old' },
      });
      aiMock.sendMessage.mockResolvedValue({
        response: JSON.stringify({
          topics: ['liquidación'],
          decisions: ['usar planilla'],
          progress_note: 'buen avance',
        }),
      });
      prismaMock.simulationInstance.update.mockResolvedValue({});

      const result = await service.completePractice(studentId, 'inst-1');

      expect(result.all_completed).toBe(false);
      expect(prismaMock.simulationInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            session_state: expect.objectContaining({
              encore_summary: expect.stringContaining('liquidación'),
            }),
          }),
        }),
      );
    });
  });

  describe('getPracticePromptExtras', () => {
    it('returns agent_key, difficulty label and prior_context', async () => {
      prismaMock.simulationInstance.findUnique.mockResolvedValue({
        id: 'inst-2',
        student_id: studentId,
        course_id: courseId,
        session_state: null,
        scenario: practices[1],
      });
      prismaMock.scenario.findFirst.mockResolvedValue(practices[0]);
      prismaMock.simulationInstance.findFirst.mockResolvedValue({
        practice_summary: 'Contexto previo del alumno.',
      });

      const extras = await service.getPracticePromptExtras('inst-2');

      expect(extras).toEqual({
        agent_key: 'practica-2',
        difficulty: 'baja',
        prior_context: 'Contexto previo del alumno.',
      });
    });

    it('should blend encore_summary into prior_context when present', async () => {
      prismaMock.simulationInstance.findUnique.mockResolvedValue({
        id: 'inst-3',
        student_id: studentId,
        course_id: courseId,
        session_state: {
          encore_summary: '{"topics":["contabilidad"],"decisions":[],"progress_note":"avanzó"}',
        },
        scenario: practices[1],
      });

      const extras = await service.getPracticePromptExtras('inst-3');

      expect(extras.prior_context).toContain('contabilidad');
      expect(extras.prior_context).toContain('avanzó');
    });
  });
});
