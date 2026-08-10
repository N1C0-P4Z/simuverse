import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

const EMPTY_REVIEW_STATS = {
  total_evaluations: 0,
  avg_score: '0',
  avg_minutes: 0,
  approval_rate: 0,
  completed_this_week: 0,
  top_courses: [] as Array<{ title: string; uses: number; avg_score: string }>,
  top_students: [] as Array<{ name: string; sims: number; avg_score: string }>,
};

function normalizeGroupByCount(count: unknown): number {
  if (typeof count === 'number') return count;
  if (count && typeof count === 'object') {
    const c = count as Record<string, number | undefined>;
    return c._all ?? c.role ?? c.id ?? 0;
  }
  return 0;
}

@Controller('global-stats')
@Roles('admin')
@UseGuards(RolesGuard)
export class GlobalStatsController {
  private readonly logger = new Logger(GlobalStatsController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  async getStats() {
    // Non-zero review stats require migration 20260807_add_course_rubrics (session_rubric_reviews).
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const usersRaw = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });

    const users = usersRaw.map((u) => ({
      role: u.role,
      count: normalizeGroupByCount(u._count),
    }));

    let reviewStats = { ...EMPTY_REVIEW_STATS };

    try {
      reviewStats = await this.fetchReviewStats(weekAgo);
    } catch (err) {
      this.logger.error(
        'Review metrics unavailable (apply migration 20260807_add_course_rubrics for session_rubric_reviews)',
        err instanceof Error ? err.stack : err,
      );
    }

    return {
      users,
      ...reviewStats,
    };
  }

  private async fetchReviewStats(weekAgo: Date) {
    const [
      totalReviews,
      passedReviews,
      completedThisWeek,
      scoreRows,
      reviewsWithContext,
    ] = await Promise.all([
      this.prisma.sessionRubricReview.count(),
      this.prisma.sessionRubricReview.count({ where: { passed: true } }),
      this.prisma.sessionRubricReview.count({
        where: { reviewed_at: { gte: weekAgo } },
      }),
      this.prisma.sessionRubricReview.findMany({
        select: { total_score: true, max_score: true },
      }),
      this.prisma.sessionRubricReview.findMany({
        select: {
          total_score: true,
          max_score: true,
          simulation_instance: {
            select: {
              time_spent_seconds: true,
              course: { select: { title: true } },
              student: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const approvalRate =
      totalReviews > 0 ? Math.round((passedReviews / totalReviews) * 100) : 0;

    const avgScore =
      scoreRows.length > 0
        ? (
            scoreRows.reduce(
              (sum, r) =>
                sum + (r.max_score > 0 ? (r.total_score / r.max_score) * 100 : 0),
              0,
            ) / scoreRows.length
          ).toFixed(1)
        : '0';

    const timeSpent = reviewsWithContext
      .map((r) => r.simulation_instance?.time_spent_seconds)
      .filter((s): s is number => s != null);
    const avgMinutes =
      timeSpent.length > 0
        ? Math.round(timeSpent.reduce((a, b) => a + b, 0) / timeSpent.length / 60)
        : 0;

    const courseAgg = new Map<
      string,
      { title: string; uses: number; scoreSum: number; scoreCount: number }
    >();
    const studentAgg = new Map<
      string,
      { name: string; sims: number; scoreSum: number; scoreCount: number }
    >();

    for (const r of reviewsWithContext) {
      const pct = r.max_score > 0 ? (r.total_score / r.max_score) * 100 : 0;

      const courseTitle = r.simulation_instance?.course?.title ?? 'Sin curso';
      const courseEntry = courseAgg.get(courseTitle) ?? {
        title: courseTitle,
        uses: 0,
        scoreSum: 0,
        scoreCount: 0,
      };
      courseEntry.uses++;
      if (r.max_score > 0) {
        courseEntry.scoreSum += pct;
        courseEntry.scoreCount++;
      }
      courseAgg.set(courseTitle, courseEntry);

      const studentName = r.simulation_instance?.student?.name ?? 'Sin nombre';
      const studentEntry = studentAgg.get(studentName) ?? {
        name: studentName,
        sims: 0,
        scoreSum: 0,
        scoreCount: 0,
      };
      studentEntry.sims++;
      if (r.max_score > 0) {
        studentEntry.scoreSum += pct;
        studentEntry.scoreCount++;
      }
      studentAgg.set(studentName, studentEntry);
    }

    const topCourses = [...courseAgg.values()]
      .map((c) => ({
        title: c.title,
        uses: c.uses,
        avg_score:
          c.scoreCount > 0 ? (c.scoreSum / c.scoreCount).toFixed(1) : '0',
      }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 5);

    const topStudents = [...studentAgg.values()]
      .map((s) => ({
        name: s.name,
        sims: s.sims,
        avg_score:
          s.scoreCount > 0 ? (s.scoreSum / s.scoreCount).toFixed(1) : '0',
      }))
      .sort((a, b) => Number(b.avg_score) - Number(a.avg_score))
      .slice(0, 5);

    return {
      total_evaluations: totalReviews,
      avg_score: avgScore,
      avg_minutes: avgMinutes,
      approval_rate: approvalRate,
      completed_this_week: completedThisWeek,
      top_courses: topCourses,
      top_students: topStudents,
    };
  }
}
