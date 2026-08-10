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
    const rubric = await this.prisma.courseRubric.findFirst({
      where: { course_id: course.id, active: true },
      include: {
        criteria: {
          where: { active: true },
          orderBy: { sort_order: 'asc' },
          include: {
            descriptors: { include: { level: true } },
          },
        },
        levels: {
          where: { active: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });
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
