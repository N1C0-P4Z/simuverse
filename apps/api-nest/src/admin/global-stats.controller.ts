import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('global-stats')
@Roles('admin')
@UseGuards(RolesGuard)
export class GlobalStatsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getStats() {
    const prisma = this.prisma as any;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      users,
      totalReviews,
      passedReviews,
      completedThisWeek,
      avgMinutesRow,
      scoreRows,
      topCourses,
      topStudents,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.sessionRubricReview.count(),
      prisma.sessionRubricReview.count({ where: { passed: true } }),
      prisma.sessionRubricReview.count({ where: { reviewed_at: { gte: weekAgo } } }),
      prisma.$queryRaw<Array<{ avg_seconds: number | null }>>`
        SELECT AVG(si.time_spent_seconds)::float AS avg_seconds
        FROM session_rubric_reviews srr
        JOIN simulation_instances si ON si.id = srr.simulation_instance_id
        WHERE si.time_spent_seconds IS NOT NULL
      `,
      prisma.sessionRubricReview.findMany({
        select: { total_score: true, max_score: true },
      }),
      prisma.$queryRaw<Array<{ title: string; uses: bigint; avg_score: string }>>`
        SELECT c.title,
               COUNT(srr.id)::int AS uses,
               ROUND(AVG(srr.total_score::float / NULLIF(srr.max_score, 0) * 100), 1)::text AS avg_score
        FROM session_rubric_reviews srr
        JOIN simulation_instances si ON si.id = srr.simulation_instance_id
        JOIN courses c ON c.id = si.course_id
        GROUP BY c.id, c.title
        ORDER BY uses DESC
        LIMIT 5
      `,
      prisma.$queryRaw<Array<{ name: string; sims: bigint; avg_score: string }>>`
        SELECT u.name,
               COUNT(srr.id)::int AS sims,
               ROUND(AVG(srr.total_score::float / NULLIF(srr.max_score, 0) * 100), 1)::text AS avg_score
        FROM session_rubric_reviews srr
        JOIN simulation_instances si ON si.id = srr.simulation_instance_id
        JOIN users u ON u.id = si.student_id
        GROUP BY u.id, u.name
        ORDER BY AVG(srr.total_score::float / NULLIF(srr.max_score, 0)) DESC
        LIMIT 5
      `,
    ]);

    const approvalRate =
      totalReviews > 0 ? Math.round((passedReviews / totalReviews) * 100) : 0;

    const avgScore =
      scoreRows.length > 0
        ? (
            scoreRows.reduce(
              (sum: number, r: { total_score: number; max_score: number }) =>
                sum + (r.max_score > 0 ? (r.total_score / r.max_score) * 100 : 0),
              0,
            ) / scoreRows.length
          ).toFixed(1)
        : '0';

    const avgSeconds = avgMinutesRow[0]?.avg_seconds ?? 0;

    return {
      users: users.map((u: any) => ({ role: u.role, count: u._count })),
      total_evaluations: totalReviews,
      avg_score: avgScore,
      avg_minutes: Math.round(Number(avgSeconds) / 60),
      approval_rate: approvalRate,
      completed_this_week: completedThisWeek,
      top_courses: topCourses.map((c) => ({
        title: c.title,
        uses: Number(c.uses),
        avg_score: c.avg_score ?? '0',
      })),
      top_students: topStudents.map((s) => ({
        name: s.name,
        sims: Number(s.sims),
        avg_score: s.avg_score ?? '0',
      })),
    };
  }
}
