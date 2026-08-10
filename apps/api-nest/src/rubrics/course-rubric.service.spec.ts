import { CourseRubricService } from './course-rubric.service';
import {
  DEFAULT_PASS_THRESHOLD,
  DEFAULT_RUBRIC_CRITERIA,
  DEFAULT_RUBRIC_LEVELS,
  DEFAULT_RUBRIC_NAME,
  LEGACY_RUBRIC_NAME,
} from './default-rubric.data';

describe('CourseRubricService', () => {
  let service: CourseRubricService;
  let prisma: any;

  const mockRubric = {
    pass_threshold: DEFAULT_PASS_THRESHOLD,
    criteria: DEFAULT_RUBRIC_CRITERIA.map((c) => ({
      code: c.code,
      active: true,
    })),
    levels: DEFAULT_RUBRIC_LEVELS.map((l) => ({
      value: l.value,
      active: true,
    })),
  };

  beforeEach(() => {
    prisma = {
      course: {
        findUnique: jest.fn(),
      },
      courseRubric: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      rubricLevel: { create: jest.fn() },
      rubricCriterion: { create: jest.fn() },
      rubricCriterionLevelDescriptor: { create: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    service = new CourseRubricService(prisma);
  });

  describe('validateScores', () => {
    it('calculates total, max and passed when threshold met', () => {
      const scores = Object.fromEntries(
        DEFAULT_RUBRIC_CRITERIA.map((c) => [c.code, 3]),
      );
      const result = service.validateScores(mockRubric, scores);
      expect(result.total_score).toBe(24);
      expect(result.max_score).toBe(32);
      expect(result.passed).toBe(true);
      expect(result.pass_threshold).toBe(24);
    });

    it('marks failed when below pass_threshold', () => {
      const scores = Object.fromEntries(
        DEFAULT_RUBRIC_CRITERIA.map((c) => [c.code, 2]),
      );
      const result = service.validateScores(mockRubric, scores);
      expect(result.total_score).toBe(16);
      expect(result.passed).toBe(false);
    });

    it('rejects missing criterion', () => {
      const scores = { COMPRENSION: 3 };
      expect(() => service.validateScores(mockRubric, scores)).toThrow(
        'Missing score for criterion',
      );
    });

    it('rejects invalid level value', () => {
      const scores = Object.fromEntries(
        DEFAULT_RUBRIC_CRITERIA.map((c) => [c.code, 5]),
      );
      expect(() => service.validateScores(mockRubric, scores)).toThrow(
        'must be one of',
      );
    });
  });

  describe('getActiveRubricForCourse', () => {
    it('renames legacy rubric name on read', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.courseRubric.findFirst.mockResolvedValue({
        id: 'rubric-1',
        course_id: 'course-1',
        name: LEGACY_RUBRIC_NAME,
        pass_threshold: DEFAULT_PASS_THRESHOLD,
        active: true,
        created_at: new Date('2026-01-01'),
        criteria: [],
        levels: [],
      });
      prisma.courseRubric.update.mockResolvedValue({});

      const result = await service.getActiveRubricForCourse('course-1');

      expect(prisma.courseRubric.update).toHaveBeenCalledWith({
        where: { id: 'rubric-1' },
        data: { name: DEFAULT_RUBRIC_NAME },
      });
      expect(result.name).toBe(DEFAULT_RUBRIC_NAME);
    });
  });

  describe('cloneDefaultRubricToCourse', () => {
    it('returns existing active rubric without creating', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.courseRubric.findFirst.mockResolvedValue({ id: 'rubric-1', name: DEFAULT_RUBRIC_NAME });

      const result = await service.cloneDefaultRubricToCourse('course-1');

      expect(result).toEqual({ id: 'rubric-1', name: DEFAULT_RUBRIC_NAME });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.courseRubric.update).not.toHaveBeenCalled();
    });

    it('renames legacy rubric name when existing active rubric found', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.courseRubric.findFirst.mockResolvedValue({
        id: 'rubric-1',
        name: LEGACY_RUBRIC_NAME,
      });
      prisma.courseRubric.update.mockResolvedValue({
        id: 'rubric-1',
        name: DEFAULT_RUBRIC_NAME,
      });

      const result = await service.cloneDefaultRubricToCourse('course-1');

      expect(prisma.courseRubric.update).toHaveBeenCalledWith({
        where: { id: 'rubric-1' },
        data: { name: DEFAULT_RUBRIC_NAME },
      });
      expect(result).toEqual({ id: 'rubric-1', name: DEFAULT_RUBRIC_NAME });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates rubric with criteria and levels when none exists', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.courseRubric.findFirst.mockResolvedValue(null);
      prisma.courseRubric.create.mockResolvedValue({ id: 'rubric-new' });
      prisma.rubricLevel.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `level-${data.value}`, ...data }),
      );
      prisma.rubricCriterion.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `crit-${data.code}`, ...data }),
      );
      prisma.rubricCriterionLevelDescriptor.create.mockResolvedValue({});

      const result = await service.cloneDefaultRubricToCourse('course-1');

      expect(result).toEqual({ id: 'rubric-new' });
      expect(prisma.courseRubric.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            course_id: 'course-1',
            name: DEFAULT_RUBRIC_NAME,
            pass_threshold: 24,
            active: true,
          }),
        }),
      );
      expect(prisma.rubricLevel.create).toHaveBeenCalledTimes(4);
      expect(prisma.rubricCriterion.create).toHaveBeenCalledTimes(8);
      expect(prisma.rubricCriterionLevelDescriptor.create).toHaveBeenCalledTimes(32);
    });
  });
});
