import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourseRubricService, RubricScores } from './course-rubric.service';
import { paginate } from '../common/helpers/paginate';

@Injectable()
export class SessionRubricReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rubricService: CourseRubricService,
  ) {}

  async getReview(instanceId: string, user: { id: string; role: string }) {
    await this.assertCanAccessInstance(instanceId, user);

    const review = await this.prisma.sessionRubricReview.findUnique({
      where: { simulation_instance_id: instanceId },
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
        course_rubric: { select: { id: true, name: true, pass_threshold: true } },
      },
    });

    if (!review) {
      return null;
    }

    return this.formatReview(review);
  }

  async upsertReview(
    instanceId: string,
    reviewerId: string,
    user: { id: string; role: string },
    payload: { scores: RubricScores; comment?: string },
  ) {
    await this.assertCanAccessInstance(instanceId, user);

    const instance = await this.prisma.simulationInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance) {
      throw new NotFoundException('Session not found');
    }

    const rubric = await this.rubricService.ensureActiveRubric(instance.course_id);
    const validation = this.rubricService.validateScores(rubric, payload.scores);

    const data = {
      course_rubric_id: rubric.id,
      reviewer_id: reviewerId,
      scores: payload.scores,
      total_score: validation.total_score,
      max_score: validation.max_score,
      passed: validation.passed,
      pass_threshold_snapshot: validation.pass_threshold,
      comment: payload.comment ?? null,
      reviewed_at: new Date(),
    };

    const review = await this.prisma.sessionRubricReview.upsert({
      where: { simulation_instance_id: instanceId },
      create: { simulation_instance_id: instanceId, ...data },
      update: data,
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
        course_rubric: { select: { id: true, name: true, pass_threshold: true } },
      },
    });

    return this.formatReview(review);
  }

  async listReviews(
    user: { id: string; role: string },
    opts: { course_id?: string; student_id?: string; page?: number; limit?: number },
  ) {
    const where: any = {};

    if (opts.course_id) {
      where.simulation_instance = { course_id: opts.course_id };
    }
    if (opts.student_id) {
      where.simulation_instance = {
        ...(where.simulation_instance || {}),
        student_id: opts.student_id,
      };
    }

    if (user.role === 'teacher') {
      const courseLinks = await this.prisma.courseTeacher.findMany({
        where: { teacher_id: user.id },
        select: { course_id: true },
      });
      const courseIds = courseLinks.map((l) => l.course_id);
      if (courseIds.length === 0) {
        return { data: [], total: 0, page: opts.page ?? 1, limit: opts.limit ?? 20 };
      }
      if (opts.course_id && !courseIds.includes(opts.course_id)) {
        throw new ForbiddenException('Course not assigned to you');
      }
      where.simulation_instance = {
        course_id: opts.course_id ? opts.course_id : { in: courseIds },
        ...(opts.student_id ? { student_id: opts.student_id } : {}),
        student: { role: 'student' },
      };
    } else {
      where.simulation_instance = {
        ...(where.simulation_instance || {}),
        student: { role: 'student' },
      };
    }

    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;

    const result = await paginate(this.prisma.sessionRubricReview, where, {
      page,
      limit,
      orderBy: { reviewed_at: 'desc' },
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
        simulation_instance: {
          include: {
            student: { select: { id: true, name: true, email: true } },
            course: { select: { id: true, title: true, course_id: true } },
            scenario: { select: { id: true, title: true } },
          },
        },
        course_rubric: { select: { id: true, name: true, pass_threshold: true } },
      },
    });

    return {
      ...result,
      data: (result.data as any[]).map((r) => this.formatListItem(r)),
    };
  }

  private formatReview(review: any) {
    return {
      id: review.id,
      simulation_instance_id: review.simulation_instance_id,
      scores: review.scores,
      total_score: review.total_score,
      max_score: review.max_score,
      passed: review.passed,
      pass_threshold_snapshot: review.pass_threshold_snapshot,
      comment: review.comment,
      reviewed_at: review.reviewed_at,
      reviewer: review.reviewer,
      rubric: review.course_rubric,
    };
  }

  private formatListItem(review: any) {
    const inst = review.simulation_instance;
    return {
      id: review.id,
      simulation_instance_id: review.simulation_instance_id,
      total_score: review.total_score,
      max_score: review.max_score,
      passed: review.passed,
      pass_threshold_snapshot: review.pass_threshold_snapshot,
      reviewed_at: review.reviewed_at,
      reviewer: review.reviewer,
      rubric: review.course_rubric,
      student: inst?.student
        ? { id: inst.student.id, name: inst.student.name, email: inst.student.email }
        : null,
      course: inst?.course
        ? { id: inst.course.id, course_id: inst.course.course_id, title: inst.course.title }
        : null,
      scenario_title: inst?.scenario?.title ?? null,
      session_status: inst?.status ?? null,
    };
  }

  private async assertCanAccessInstance(
    instanceId: string,
    user: { id: string; role: string },
  ) {
    const instance = await this.prisma.simulationInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance) {
      throw new NotFoundException('Session not found');
    }

    if (user.role === 'teacher') {
      const link = await this.prisma.teacherGroup.findFirst({
        where: { teacher_id: user.id, student_id: instance.student_id },
      });
      if (!link) {
        throw new ForbiddenException('Student not in your group');
      }
    } else if (!['admin', 'ministerio'].includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return instance;
  }
}
