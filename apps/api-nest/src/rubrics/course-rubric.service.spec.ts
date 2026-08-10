import { BadRequestException } from '@nestjs/common';
import { CourseRubricService } from './course-rubric.service';
import {
  DEFAULT_PASS_THRESHOLD,
  DEFAULT_RUBRIC_CRITERIA,
  DEFAULT_RUBRIC_LEVELS,
  DEFAULT_RUBRIC_NAME,
  LEGACY_RUBRIC_NAME,
} from './default-rubric.data';
import { UpdateCourseRubricDto } from './dto/update-course-rubric.dto';

function buildValidUpdateDto(): UpdateCourseRubricDto {
  return {
    name: DEFAULT_RUBRIC_NAME,
    pass_threshold: DEFAULT_PASS_THRESHOLD,
    levels: DEFAULT_RUBRIC_LEVELS.map((l) => ({
      value: l.value,
      label: l.label,
      sort_order: l.sort_order,
      active: true,
    })),
    criteria: DEFAULT_RUBRIC_CRITERIA.map((c) => ({
      code: c.code,
      label: c.label,
      sort_order: c.sort_order,
      active: true,
      descriptors: c.descriptors.map((descriptor, i) => ({
        level_value: i + 1,
        descriptor,
      })),
    })),
  };
}

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
      rubricLevel: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      rubricCriterion: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      rubricCriterionLevelDescriptor: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
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

    it('lazy-clones default rubric when course has none', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      const cloned = {
        id: 'rubric-new',
        course_id: 'course-1',
        name: DEFAULT_RUBRIC_NAME,
        pass_threshold: DEFAULT_PASS_THRESHOLD,
        active: true,
        created_at: new Date('2026-01-01'),
        criteria: [],
        levels: [],
      };
      prisma.courseRubric.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null) // cloneDefaultRubricToCourse existing check
        .mockResolvedValueOnce(cloned);
      prisma.courseRubric.create.mockResolvedValue({ id: 'rubric-new' });
      prisma.rubricLevel.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `level-${data.value}`, ...data }),
      );
      prisma.rubricCriterion.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `crit-${data.code}`, ...data }),
      );
      prisma.rubricCriterionLevelDescriptor.create.mockResolvedValue({});

      const result = await service.getActiveRubricForCourse('course-1');

      expect(prisma.courseRubric.create).toHaveBeenCalled();
      expect(result.name).toBe(DEFAULT_RUBRIC_NAME);
      expect(result.id).toBe('rubric-new');
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

  describe('validateUpdatePayload', () => {
    it('accepts valid payload', () => {
      expect(() => service.validateUpdatePayload(buildValidUpdateDto())).not.toThrow();
    });

    it('rejects when no active criteria', () => {
      const dto = buildValidUpdateDto();
      dto.criteria = dto.criteria.map((c) => ({ ...c, active: false }));
      expect(() => service.validateUpdatePayload(dto)).toThrow(BadRequestException);
      expect(() => service.validateUpdatePayload(dto)).toThrow('At least one active criterion');
    });

    it('rejects duplicate active criterion codes', () => {
      const dto = buildValidUpdateDto();
      dto.criteria[1].code = dto.criteria[0].code;
      expect(() => service.validateUpdatePayload(dto)).toThrow('Active criterion codes must be unique');
    });

    it('rejects missing descriptor for active level', () => {
      const dto = buildValidUpdateDto();
      dto.criteria[0].descriptors = dto.criteria[0].descriptors.filter((d) => d.level_value !== 4);
      expect(() => service.validateUpdatePayload(dto)).toThrow('missing a descriptor');
    });

    it('rejects pass_threshold above max score', () => {
      const dto = buildValidUpdateDto();
      dto.pass_threshold = 999;
      expect(() => service.validateUpdatePayload(dto)).toThrow('pass_threshold must be between');
    });
  });

  describe('updateRubric', () => {
    const existingRubric = {
      id: 'rubric-1',
      course_id: 'course-1',
      name: DEFAULT_RUBRIC_NAME,
      pass_threshold: DEFAULT_PASS_THRESHOLD,
      active: true,
      levels: DEFAULT_RUBRIC_LEVELS.map((l, i) => ({
        id: `level-${i + 1}`,
        value: l.value,
        label: l.label,
        description: null,
        sort_order: l.sort_order,
        active: true,
      })),
      criteria: DEFAULT_RUBRIC_CRITERIA.map((c, i) => ({
        id: `crit-${i + 1}`,
        code: c.code,
        label: c.label,
        description: null,
        sort_order: c.sort_order,
        active: true,
        descriptors: c.descriptors.map((descriptor, j) => ({
          id: `desc-${i + 1}-${j + 1}`,
          criterion_id: `crit-${i + 1}`,
          level_id: `level-${j + 1}`,
          descriptor,
        })),
      })),
    };

    beforeEach(() => {
      prisma.courseRubric.findUnique = jest.fn().mockResolvedValue(existingRubric);
      prisma.rubricLevel.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve({ id: where.id, ...data }),
      );
      prisma.rubricLevel.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `new-level-${data.value}`, ...data }),
      );
      prisma.rubricCriterion.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve({ id: where.id, code: 'CODE', ...data }),
      );
      prisma.rubricCriterion.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `new-crit-${data.code}`, ...data }),
      );
      prisma.rubricCriterionLevelDescriptor.update.mockResolvedValue({});
      prisma.rubricCriterionLevelDescriptor.create.mockResolvedValue({});
      prisma.rubricCriterionLevelDescriptor.delete.mockResolvedValue({});
      prisma.rubricLevel.findMany.mockResolvedValue(existingRubric.levels);
      prisma.rubricCriterion.findMany.mockResolvedValue(existingRubric.criteria);
    });

    it('updates rubric meta and returns formatted rubric', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.courseRubric.findFirst
        .mockResolvedValueOnce({ id: 'rubric-1' })
        .mockResolvedValueOnce({
          ...existingRubric,
          created_at: new Date('2026-01-01'),
          criteria: existingRubric.criteria.map((c) => ({
            ...c,
            descriptors: c.descriptors.map((d) => ({
              ...d,
              level: { value: Number(d.level_id.replace('level-', '')) },
            })),
          })),
        });

      const dto = buildValidUpdateDto();
      dto.name = 'Rubrica Custom';
      dto.levels = existingRubric.levels.map((l) => ({
        id: l.id,
        value: l.value,
        label: l.label,
        sort_order: l.sort_order,
        active: true,
      }));
      dto.criteria = existingRubric.criteria.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        sort_order: c.sort_order,
        active: true,
        descriptors: DEFAULT_RUBRIC_CRITERIA.find((dc) => dc.code === c.code)!.descriptors.map(
          (descriptor, i) => ({ level_value: i + 1, descriptor }),
        ),
      }));

      const result = await service.updateRubric('course-1', dto);

      expect(prisma.courseRubric.update).toHaveBeenCalledWith({
        where: { id: 'rubric-1' },
        data: { name: 'Rubrica Custom', pass_threshold: DEFAULT_PASS_THRESHOLD },
      });
      expect(result.name).toBe(DEFAULT_RUBRIC_NAME);
    });

    it('clones default rubric when none exists before update', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.courseRubric.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'rubric-new', name: DEFAULT_RUBRIC_NAME })
        .mockResolvedValueOnce({
          ...existingRubric,
          id: 'rubric-new',
          created_at: new Date('2026-01-01'),
          criteria: [],
          levels: [],
        });

      const cloneSpy = jest
        .spyOn(service, 'cloneDefaultRubricToCourse')
        .mockResolvedValue({ id: 'rubric-new', name: DEFAULT_RUBRIC_NAME } as any);

      const dto = buildValidUpdateDto();
      await service.updateRubric('course-1', dto);

      expect(cloneSpy).toHaveBeenCalledWith('course-1');
      cloneSpy.mockRestore();
    });

    it('keeps existing criterion code when id is provided', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.courseRubric.findFirst
        .mockResolvedValueOnce({ id: 'rubric-1' })
        .mockResolvedValueOnce({
          ...existingRubric,
          created_at: new Date('2026-01-01'),
          criteria: existingRubric.criteria.map((c) => ({
            ...c,
            descriptors: c.descriptors.map((d) => ({
              ...d,
              level: { value: Number(d.level_id.replace('level-', '')) },
            })),
          })),
        });

      const dto = buildValidUpdateDto();
      dto.criteria[0].id = 'crit-1';
      dto.criteria[0].code = 'CHANGED_CODE';

      await service.updateRubric('course-1', dto);

      expect(prisma.rubricCriterion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'crit-1' },
          data: expect.not.objectContaining({ code: 'CHANGED_CODE' }),
        }),
      );
    });
  });
});
