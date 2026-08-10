import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PASS_THRESHOLD,
  DEFAULT_RUBRIC_CRITERIA,
  DEFAULT_RUBRIC_LEVELS,
  DEFAULT_RUBRIC_NAME,
  LEGACY_RUBRIC_NAME,
} from './default-rubric.data';
import { UpdateCourseRubricDto } from './dto/update-course-rubric.dto';

export type RubricScores = Record<string, number>;

export interface ScoreValidationResult {
  total_score: number;
  max_score: number;
  passed: boolean;
  pass_threshold: number;
}

type RubricForValidation = {
  pass_threshold: number;
  criteria: Array<{ code: string; active: boolean }>;
  levels: Array<{ value: number; active: boolean }>;
};

@Injectable()
export class CourseRubricService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveRubricForCourse(courseId: string) {
    const course = await this.resolveCourse(courseId);
    const rubricInclude = {
      criteria: {
        where: { active: true },
        orderBy: { sort_order: 'asc' as const },
        include: {
          descriptors: { include: { level: true } },
        },
      },
      levels: {
        where: { active: true },
        orderBy: { sort_order: 'asc' as const },
      },
    };

    let rubric = await this.prisma.courseRubric.findFirst({
      where: { course_id: course.id, active: true },
      include: rubricInclude,
    });

    // Existing courses (pre-feature) have no row — seed gate skips backfill on deploy.
    // Lazy-clone like updateRubric so Admin ABM / teacher Calificar don't 404.
    if (!rubric) {
      await this.cloneDefaultRubricToCourse(course.id);
      rubric = await this.prisma.courseRubric.findFirst({
        where: { course_id: course.id, active: true },
        include: rubricInclude,
      });
    }

    if (!rubric) {
      throw new NotFoundException('Active rubric not found for course');
    }
    const synced = await this.syncRubricNameIfLegacy(rubric);
    return this.formatRubric(synced);
  }

  async cloneDefaultRubricToCourse(courseId: string) {
    const course = await this.resolveCourse(courseId);

    const existing = await this.prisma.courseRubric.findFirst({
      where: { course_id: course.id, active: true },
    });
    if (existing) {
      return this.syncRubricNameIfLegacy(existing);
    }

    return this.prisma.$transaction(async (tx) => {
      const rubric = await tx.courseRubric.create({
        data: {
          id: crypto.randomUUID(),
          course_id: course.id,
          name: DEFAULT_RUBRIC_NAME,
          pass_threshold: DEFAULT_PASS_THRESHOLD,
          active: true,
        },
      });

      const levelRecords = await Promise.all(
        DEFAULT_RUBRIC_LEVELS.map((level) =>
          tx.rubricLevel.create({
            data: {
              id: crypto.randomUUID(),
              course_rubric_id: rubric.id,
              value: level.value,
              label: level.label,
              sort_order: level.sort_order,
              active: true,
            },
          }),
        ),
      );

      const levelByValue = new Map(levelRecords.map((l) => [l.value, l]));

      for (const criterion of DEFAULT_RUBRIC_CRITERIA) {
        const createdCriterion = await tx.rubricCriterion.create({
          data: {
            id: crypto.randomUUID(),
            course_rubric_id: rubric.id,
            code: criterion.code,
            label: criterion.label,
            sort_order: criterion.sort_order,
            active: true,
          },
        });

        for (let i = 0; i < criterion.descriptors.length; i++) {
          const levelValue = i + 1;
          const level = levelByValue.get(levelValue);
          if (!level) continue;
          await tx.rubricCriterionLevelDescriptor.create({
            data: {
              id: crypto.randomUUID(),
              criterion_id: createdCriterion.id,
              level_id: level.id,
              descriptor: criterion.descriptors[i],
            },
          });
        }
      }

      return rubric;
    });
  }

  validateScores(
    rubric: RubricForValidation,
    scores: RubricScores,
  ): ScoreValidationResult {
    const activeCriteria = rubric.criteria.filter((c) => c.active);
    const activeLevels = rubric.levels.filter((l) => l.active);
    const allowedValues = new Set(activeLevels.map((l) => l.value));

    if (!activeCriteria.length) {
      throw new BadRequestException('Rubric has no active criteria');
    }

    const scoreKeys = Object.keys(scores);
    const expectedCodes = activeCriteria.map((c) => c.code);

    for (const code of expectedCodes) {
      if (!(code in scores)) {
        throw new BadRequestException(`Missing score for criterion: ${code}`);
      }
    }

    for (const key of scoreKeys) {
      if (!expectedCodes.includes(key)) {
        throw new BadRequestException(`Unknown criterion code: ${key}`);
      }
    }

    let total_score = 0;
    for (const criterion of activeCriteria) {
      const value = scores[criterion.code];
      if (!Number.isInteger(value)) {
        throw new BadRequestException(`Score for ${criterion.code} must be an integer`);
      }
      if (!allowedValues.has(value)) {
        throw new BadRequestException(
          `Score for ${criterion.code} must be one of: ${[...allowedValues].join(', ')}`,
        );
      }
      total_score += value;
    }

    const maxLevelValue = Math.max(...activeLevels.map((l) => l.value));
    const max_score = activeCriteria.length * maxLevelValue;
    const passed = total_score >= rubric.pass_threshold;

    return {
      total_score,
      max_score,
      passed,
      pass_threshold: rubric.pass_threshold,
    };
  }

  validateUpdatePayload(dto: UpdateCourseRubricDto): void {
    const activeLevels = dto.levels.filter((l) => l.active !== false);
    const activeCriteria = dto.criteria.filter((c) => c.active !== false);

    if (!activeLevels.length) {
      throw new BadRequestException('At least one active level is required');
    }
    if (!activeCriteria.length) {
      throw new BadRequestException('At least one active criterion is required');
    }

    const levelValues = activeLevels.map((l) => l.value);
    if (new Set(levelValues).size !== levelValues.length) {
      throw new BadRequestException('Active level values must be unique');
    }

    const codes = activeCriteria.map((c) => c.code);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Active criterion codes must be unique');
    }

    const activeLevelValues = new Set(levelValues);
    for (const criterion of activeCriteria) {
      for (const levelValue of activeLevelValues) {
        const hasDescriptor = criterion.descriptors.some(
          (d) => d.level_value === levelValue && d.descriptor.trim().length > 0,
        );
        if (!hasDescriptor) {
          throw new BadRequestException(
            `Criterion ${criterion.code} is missing a descriptor for level value ${levelValue}`,
          );
        }
      }
    }

    const maxLevelValue = Math.max(...levelValues);
    const maxScore = activeCriteria.length * maxLevelValue;
    if (dto.pass_threshold < 1 || dto.pass_threshold > maxScore) {
      throw new BadRequestException(
        `pass_threshold must be between 1 and ${maxScore}`,
      );
    }
  }

  async updateRubric(courseId: string, dto: UpdateCourseRubricDto) {
    const course = await this.resolveCourse(courseId);
    this.validateUpdatePayload(dto);

    let rubric = await this.prisma.courseRubric.findFirst({
      where: { course_id: course.id, active: true },
    });
    if (!rubric) {
      await this.cloneDefaultRubricToCourse(courseId);
      rubric = await this.prisma.courseRubric.findFirst({
        where: { course_id: course.id, active: true },
      });
    }
    if (!rubric) {
      throw new NotFoundException('Active rubric not found for course');
    }

    const existing = await this.prisma.courseRubric.findUnique({
      where: { id: rubric.id },
      include: {
        levels: { orderBy: { sort_order: 'asc' } },
        criteria: {
          orderBy: { sort_order: 'asc' },
          include: { descriptors: true },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Active rubric not found for course');
    }

    const existingCriterionById = new Map(existing.criteria.map((c) => [c.id, c]));
    const dtoLevelIds = new Set(dto.levels.filter((l) => l.id).map((l) => l.id!));
    const dtoCriterionIds = new Set(dto.criteria.filter((c) => c.id).map((c) => c.id!));

    await this.prisma.$transaction(async (tx) => {
      await tx.courseRubric.update({
        where: { id: existing.id },
        data: { name: dto.name, pass_threshold: dto.pass_threshold },
      });

      for (const level of existing.levels) {
        if (!dtoLevelIds.has(level.id)) {
          await tx.rubricLevel.update({
            where: { id: level.id },
            data: { active: false },
          });
        }
      }

      const levelIdByValue = new Map<number, string>();

      for (const levelDto of dto.levels) {
        const isActive = levelDto.active !== false;
        if (levelDto.id) {
          const updated = await tx.rubricLevel.update({
            where: { id: levelDto.id },
            data: {
              value: levelDto.value,
              label: levelDto.label,
              description: levelDto.description ?? null,
              sort_order: levelDto.sort_order,
              active: isActive,
            },
          });
          if (isActive) levelIdByValue.set(updated.value, updated.id);
        } else {
          const created = await tx.rubricLevel.create({
            data: {
              id: crypto.randomUUID(),
              course_rubric_id: existing.id,
              value: levelDto.value,
              label: levelDto.label,
              description: levelDto.description ?? null,
              sort_order: levelDto.sort_order,
              active: isActive,
            },
          });
          if (isActive) levelIdByValue.set(created.value, created.id);
        }
      }

      for (const criterion of existing.criteria) {
        if (!dtoCriterionIds.has(criterion.id)) {
          await tx.rubricCriterion.update({
            where: { id: criterion.id },
            data: { active: false },
          });
        }
      }

      const criterionIdByCode = new Map<string, string>();

      for (const criterionDto of dto.criteria) {
        const isActive = criterionDto.active !== false;
        const existingCriterion = criterionDto.id
          ? existingCriterionById.get(criterionDto.id)
          : undefined;
        const code = existingCriterion ? existingCriterion.code : criterionDto.code;

        let criterionId: string;
        if (criterionDto.id && existingCriterion) {
          const updated = await tx.rubricCriterion.update({
            where: { id: criterionDto.id },
            data: {
              label: criterionDto.label,
              description: criterionDto.description ?? null,
              sort_order: criterionDto.sort_order,
              active: isActive,
            },
          });
          criterionId = updated.id;
        } else {
          const created = await tx.rubricCriterion.create({
            data: {
              id: crypto.randomUUID(),
              course_rubric_id: existing.id,
              code: criterionDto.code,
              label: criterionDto.label,
              description: criterionDto.description ?? null,
              sort_order: criterionDto.sort_order,
              active: isActive,
            },
          });
          criterionId = created.id;
        }

        if (isActive) criterionIdByCode.set(code, criterionId);

        const wantedDescriptors = new Map<number, string>();
        for (const d of criterionDto.descriptors) {
          wantedDescriptors.set(d.level_value, d.descriptor);
        }

        const activeLevelValues = dto.levels
          .filter((l) => l.active !== false)
          .map((l) => l.value);

        for (const levelValue of activeLevelValues) {
          const levelId = levelIdByValue.get(levelValue);
          if (!levelId) continue;
          const descriptor = wantedDescriptors.get(levelValue);
          if (!descriptor) continue;

          const existingDescriptor = existing.criteria
            .flatMap((c) => c.descriptors)
            .find((d) => d.criterion_id === criterionId && d.level_id === levelId);

          if (existingDescriptor) {
            await tx.rubricCriterionLevelDescriptor.update({
              where: { id: existingDescriptor.id },
              data: { descriptor },
            });
          } else {
            await tx.rubricCriterionLevelDescriptor.create({
              data: {
                id: crypto.randomUUID(),
                criterion_id: criterionId,
                level_id: levelId,
                descriptor,
              },
            });
          }
        }
      }

      const allCriteria = await tx.rubricCriterion.findMany({
        where: { course_rubric_id: existing.id },
        include: { descriptors: true },
      });
      const allLevels = await tx.rubricLevel.findMany({
        where: { course_rubric_id: existing.id },
      });
      const activeLevelIds = new Set(
        allLevels.filter((l) => l.active).map((l) => l.id),
      );
      const activeCriterionIds = new Set(
        allCriteria.filter((c) => c.active).map((c) => c.id),
      );

      const validPairs = new Set<string>();
      for (const criterionDto of dto.criteria) {
        if (criterionDto.active === false) continue;
        const existingCriterion = criterionDto.id
          ? existingCriterionById.get(criterionDto.id)
          : undefined;
        const code = existingCriterion ? existingCriterion.code : criterionDto.code;
        const criterionId = criterionIdByCode.get(code);
        if (!criterionId) continue;
        for (const levelDto of dto.levels) {
          if (levelDto.active === false) continue;
          const levelId = levelIdByValue.get(levelDto.value);
          if (levelId) validPairs.add(`${criterionId}:${levelId}`);
        }
      }

      for (const criterion of allCriteria) {
        for (const descriptor of criterion.descriptors) {
          const pairKey = `${descriptor.criterion_id}:${descriptor.level_id}`;
          const isOrphan =
            !activeCriterionIds.has(descriptor.criterion_id) ||
            !activeLevelIds.has(descriptor.level_id) ||
            !validPairs.has(pairKey);
          if (isOrphan) {
            await tx.rubricCriterionLevelDescriptor.delete({
              where: { id: descriptor.id },
            });
          }
        }
      }
    });

    return this.getActiveRubricForCourse(courseId);
  }

  async ensureActiveRubric(courseId: string) {
    const course = await this.resolveCourse(courseId);
    const rubric = await this.prisma.courseRubric.findFirst({
      where: { course_id: course.id, active: true },
      include: {
        criteria: { where: { active: true }, orderBy: { sort_order: 'asc' } },
        levels: { where: { active: true }, orderBy: { sort_order: 'asc' } },
      },
    });
    if (!rubric) {
      throw new NotFoundException('Active rubric not found for course');
    }
    return rubric;
  }

  private formatRubric(rubric: {
    id: string;
    course_id: string;
    name: string;
    pass_threshold: number;
    active: boolean;
    created_at: Date;
    criteria: Array<{
      id: string;
      code: string;
      label: string;
      description: string | null;
      sort_order: number;
      descriptors: Array<{ level: { value: number }; descriptor: string }>;
    }>;
    levels: Array<{
      id: string;
      value: number;
      label: string;
      description: string | null;
      sort_order: number;
    }>;
  }) {
    return {
      id: rubric.id,
      course_id: rubric.course_id,
      name: rubric.name,
      pass_threshold: rubric.pass_threshold,
      active: rubric.active,
      created_at: rubric.created_at,
      levels: rubric.levels.map((l) => ({
        id: l.id,
        value: l.value,
        label: l.label,
        description: l.description,
        sort_order: l.sort_order,
      })),
      criteria: rubric.criteria.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        description: c.description,
        sort_order: c.sort_order,
        descriptors: Object.fromEntries(
          c.descriptors.map((d) => [String(d.level.value), d.descriptor]),
        ),
      })),
    };
  }

  private async syncRubricNameIfLegacy<T extends { id: string; name: string }>(rubric: T): Promise<T> {
    if (rubric.name !== LEGACY_RUBRIC_NAME) {
      return rubric;
    }
    await this.prisma.courseRubric.update({
      where: { id: rubric.id },
      data: { name: DEFAULT_RUBRIC_NAME },
    });
    return { ...rubric, name: DEFAULT_RUBRIC_NAME };
  }

  private async resolveCourse(courseId: string) {
    let course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      course = await this.prisma.course.findUnique({ where: { course_id: courseId } });
    }
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }
}
