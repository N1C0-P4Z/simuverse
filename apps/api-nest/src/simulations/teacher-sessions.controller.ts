import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate } from '../common/helpers/paginate';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'admin', 'ministerio')
@Controller('teacher/sessions')
export class TeacherSessionsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List simulation instances for courses/students visible to the teacher.
   * Teachers are limited to TeacherGroup students unless admin/ministerio.
   */
  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('course_id') courseId?: string,
    @Query('student_id') studentId?: string,
    @Query() pagination?: PaginationDto,
  ) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;

    const where: any = {};
    if (courseId) where.course_id = courseId;
    if (studentId) where.student_id = studentId;
    // Only surface sessions run by actual students — teachers/admins testing a
    // simulation should not show up in the "Alumno" filter.
    where.student = { role: 'student' };

    if (user?.role === 'teacher') {
      const links = await this.prisma.teacherGroup.findMany({
        where: { teacher_id: user.id },
        select: { student_id: true },
      });
      const studentIds = links.map((l) => l.student_id);
      if (studentIds.length === 0) return { data: [], total: 0, page, limit };
      where.student_id = studentId
        ? studentId
        : { in: studentIds };
      if (studentId && !studentIds.includes(studentId)) {
        throw new ForbiddenException('Student not in your group');
      }
    }

    const result = await paginate(this.prisma.simulationInstance, where, {
      page,
      limit,
      orderBy: { started_at: 'desc' },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
        scenario: {
          select: {
            id: true,
            title: true,
            scenario_type: true,
            difficulty: true,
            agent_key: true,
            sequence_index: true,
          },
        },
      },
    });

    const withStats = await Promise.all(
      (result.data as any[]).map(async (inst: any) => {
        const turnCount = await this.prisma.simulationChatLog.count({
          where: { simulation_instance_id: inst.id },
        });
        return {
          id: inst.id,
          status: inst.status,
          score: inst.score,
          started_at: inst.started_at,
          completed_at: inst.completed_at,
          progress_percentage: inst.progress_percentage,
          student_id: inst.student_id,
          student_name: inst.student?.name,
          student_email: inst.student?.email,
          course_id: inst.course_id,
          course_title: inst.course?.title,
          scenario_title: inst.scenario?.title,
          scenario_type: inst.scenario?.scenario_type,
          difficulty: inst.scenario?.difficulty,
          agent_key: inst.scenario?.agent_key,
          sequence_index: inst.scenario?.sequence_index,
          total_turns: turnCount,
        };
      }),
    );

    return { ...result, data: withStats };
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: any) {
    const instance = await this.prisma.simulationInstance.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
        scenario: true,
      },
    });
    if (!instance) {
      throw new NotFoundException('Session not found');
    }

    if (user?.role === 'teacher') {
      const link = await this.prisma.teacherGroup.findFirst({
        where: { teacher_id: user.id, student_id: instance.student_id },
      });
      if (!link) {
        throw new ForbiddenException('Student not in your group');
      }
    }

    const logs = await this.prisma.simulationChatLog.findMany({
      where: { simulation_instance_id: id },
      orderBy: { turn_number: 'asc' },
    });

    const submissions = await this.prisma.fileUpload.findMany({
      where: { simulation_instance_id: id, is_active: true },
      orderBy: { created_at: 'desc' },
    });

    // Group messages by hour for teacher view
    const byHour: Record<string, typeof logs> = {};
    for (const log of logs) {
      const hourKey = new Date(log.created_at).toISOString().slice(0, 13) + ':00';
      if (!byHour[hourKey]) byHour[hourKey] = [];
      byHour[hourKey].push(log);
    }

    return {
      instance: {
        id: instance.id,
        status: instance.status,
        score: instance.score,
        started_at: instance.started_at,
        completed_at: instance.completed_at,
        progress_percentage: instance.progress_percentage,
        practice_summary: instance.practice_summary,
        student_name: instance.student?.name,
        student_email: instance.student?.email,
        student_id: instance.student_id,
        course_title: instance.course?.title,
        scenario_title: instance.scenario?.title,
        scenario_type: instance.scenario?.scenario_type,
        difficulty: instance.scenario?.difficulty,
        agent_key: instance.scenario?.agent_key,
      },
      logs: logs.map((l) => ({
        id: l.id,
        turn_number: l.turn_number,
        speaker: l.speaker,
        message: l.message,
        message_text: l.message,
        created_at: l.created_at,
        is_correct: l.is_correct,
        ref_number: l.ref_number,
      })),
      logs_by_hour: Object.entries(byHour)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, hourLogs]) => ({
          hour,
          messages: hourLogs.map((l) => ({
            id: l.id,
            turn_number: l.turn_number,
            speaker: l.speaker,
            message: l.message,
            created_at: l.created_at,
          })),
        })),
      submissions: submissions.map((f) => ({
        id: f.id,
        file_name: f.file_name,
        file_type: f.file_type,
        file_size_bytes: f.file_size_bytes.toString(),
        created_at: f.created_at,
        download_url: `/files/${f.id}/download`,
      })),
      summary: {
        total_turns: logs.length,
        student_turns: logs.filter((l) => l.speaker === 'student').length,
      },
    };
  }
}
