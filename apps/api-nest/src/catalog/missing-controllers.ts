import { Controller, Get, Post, Put, Delete, Param, Body, Query, NotFoundException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma/prisma.service';
import { logoUploadOptions, resolveLogoUrl, cleanupOldLogo } from '../files/logo-upload';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate } from '../common/helpers/paginate';

// ── Foundation Config ────────────────────────────────────────────
@Controller('foundation-config')
export class FoundationConfigController {
  constructor(private prisma: PrismaService) {}

  @Get() async findAll(@Query() pagination: PaginationDto) {
    return paginate((this.prisma as any).foundationConfig, {}, {
      page: pagination.page,
      limit: pagination.limit,
      orderBy: { id: 'asc' },
    });
  }

  @Post()
  @UseInterceptors(FileInterceptor('logo_file', logoUploadOptions))
  async create(@Body() body: any, @UploadedFile() logo_file?: Express.Multer.File) {
    const { name, short_name, logo_url, address, city, province, country, phone, email, website, description } = body;
    return (this.prisma as any).foundationConfig.create({
      data: {
        name,
        short_name: short_name ?? null,
        logo_url: resolveLogoUrl(logo_file, logo_url) ?? null,
        address: address ?? null,
        city: city ?? null,
        province: province ?? null,
        country: country ?? null,
        phone: phone ?? null,
        email: email ?? null,
        website: website ?? null,
        description: description ?? null,
      },
    });
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('logo_file', logoUploadOptions))
  async update(@Param('id') id: string, @Body() body: any, @UploadedFile() logo_file?: Express.Multer.File) {
    const { name, short_name, logo_url, address, city, province, country, phone, email, website, description, is_active } = body;

    if (logo_file) {
      const existing = await (this.prisma as any).foundationConfig.findUnique({ where: { id: Number(id) } });
      cleanupOldLogo(existing?.logo_url);
    }

    return (this.prisma as any).foundationConfig.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(short_name !== undefined && { short_name: short_name ?? null }),
        ...((logo_file || logo_url !== undefined) && { logo_url: resolveLogoUrl(logo_file, logo_url) ?? null }),
        ...(address !== undefined && { address: address ?? null }),
        ...(city !== undefined && { city: city ?? null }),
        ...(province !== undefined && { province: province ?? null }),
        ...(country !== undefined && { country: country ?? null }),
        ...(phone !== undefined && { phone: phone ?? null }),
        ...(email !== undefined && { email: email ?? null }),
        ...(website !== undefined && { website: website ?? null }),
        ...(description !== undefined && { description: description ?? null }),
        ...(is_active !== undefined && { is_active }),
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return (this.prisma as any).foundationConfig.update({
      where: { id: Number(id) },
      data: { is_active: false },
    });
  }

  @Put(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    return (this.prisma as any).foundationConfig.update({
      where: { id: Number(id) },
      data: { is_active: true },
    });
  }
}

// ── Endorsers ────────────────────────────────────────────────────
@Controller('endorsers')
export class EndorsersController {
  constructor(private prisma: PrismaService) {}

  @Get() async findAll(@Query() pagination: PaginationDto) {
    return paginate((this.prisma as any).endorser, {}, {
      page: pagination.page,
      limit: pagination.limit,
      orderBy: { id: 'asc' },
    });
  }

  @Post()
  @UseInterceptors(FileInterceptor('logo_file', logoUploadOptions))
  async create(@Body() body: any, @UploadedFile() logo_file?: Express.Multer.File) {
    const { name, short_name, logo_url, description, endorsement_type, website } = body;
    return (this.prisma as any).endorser.create({
      data: {
        name,
        short_name: short_name ?? null,
        logo_url: resolveLogoUrl(logo_file, logo_url) ?? null,
        description: description ?? null,
        endorsement_type: endorsement_type ?? 'institution',
        website: website ?? null,
      },
    });
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('logo_file', logoUploadOptions))
  async update(@Param('id') id: string, @Body() body: any, @UploadedFile() logo_file?: Express.Multer.File) {
    const { name, short_name, logo_url, description, endorsement_type, website, is_active } = body;

    if (logo_file) {
      const existing = await (this.prisma as any).endorser.findUnique({ where: { id: Number(id) } });
      cleanupOldLogo(existing?.logo_url);
    }

    return (this.prisma as any).endorser.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(short_name !== undefined && { short_name: short_name ?? null }),
        ...((logo_file || logo_url !== undefined) && { logo_url: resolveLogoUrl(logo_file, logo_url) ?? null }),
        ...(description !== undefined && { description: description ?? null }),
        ...(endorsement_type !== undefined && { endorsement_type: endorsement_type ?? null }),
        ...(website !== undefined && { website: website ?? null }),
        ...(is_active !== undefined && { is_active }),
      },
    });
  }

  @Delete(':id') async remove(@Param('id') id: string) {
    return (this.prisma as any).endorser.update({
      where: { id: Number(id) },
      data: { is_active: false },
    });
  }

  @Put(':id/reactivate') async reactivate(@Param('id') id: string) {
    return (this.prisma as any).endorser.update({
      where: { id: Number(id) },
      data: { is_active: true },
    });
  }
}

// ── Legajo ───────────────────────────────────────────────────────
@Controller('legajo')
export class LegajoController {
  constructor(private prisma: PrismaService) {}

  @Get('students')
  async getStudents(
    @Query() pagination: PaginationDto,
    @Query('course_id') courseId?: string,
    @Query('teacher_id') teacherId?: string,
    @Query('search') search?: string,
  ) {
    const empty = { data: [], total: 0, page: pagination.page, limit: pagination.limit };

    // Resolve student IDs from filters
    let studentIds: string[] | undefined;

    if (teacherId) {
      const teacherCourses = await this.prisma.courseTeacher.findMany({
        where: { teacher_id: teacherId },
        select: { course_id: true },
      });
      const courseIds = teacherCourses.map(ct => ct.course_id);
      if (courseIds.length === 0) return empty;
      const assignments = await this.prisma.simulationAssignment.findMany({
        where: { course_id: { in: courseIds } },
        select: { student_id: true },
        distinct: ['student_id'],
      });
      studentIds = assignments.map(a => a.student_id);
      if (studentIds.length === 0) return empty;
    }

    if (courseId) {
      const courseAssignments = await this.prisma.simulationAssignment.findMany({
        where: { course_id: courseId, ...(studentIds ? { student_id: { in: studentIds } } : {}) },
        select: { student_id: true },
        distinct: ['student_id'],
      });
      studentIds = courseAssignments.map(a => a.student_id);
      if (studentIds.length === 0) return empty;
    }

    const where: any = { role: 'student' };
    if (studentIds) where.id = { in: studentIds };
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const result = await paginate((this.prisma as any).user, where, {
      page: pagination.page,
      limit: pagination.limit,
      select: {
        id: true, name: true, email: true, created_at: true,
        simulations: { select: { id: true, status: true, score: true, progress_percentage: true, started_at: true } },
      },
    });

    return {
      ...result,
      data: (result.data as any[]).map(s => {
        const sims = s.simulations || [];
        const scored = sims.filter((sim: any) => sim.score != null);
        const completed = sims.filter((sim: any) => sim.status === 'completed').length;
        const avg = scored.length > 0
          ? scored.reduce((a: number, sim: any) => a + Number(sim.score), 0) / scored.length
          : null;
        const best = scored.length > 0
          ? Math.max(...scored.map((sim: any) => Number(sim.score)))
          : null;
        const last = sims
          .map((sim: any) => sim.started_at)
          .filter(Boolean)
          .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          role: 'student',
          created_at: s.created_at,
          total_simulations: sims.length,
          total_sims: sims.length,
          completed_simulations: completed,
          completed,
          total_evaluations: scored.length,
          avg_score: avg,
          best_score: best,
          last_activity: last,
        };
      }),
    };
  }

  @Get(':userId')
  async getStudentLedger(@Param('userId') userId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, created_at: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const instances = await this.prisma.simulationInstance.findMany({
      where: { student_id: userId },
      include: {
        course: { select: { title: true, category: true } },
        scenario: { select: { title: true } },
        session_rubric_review: {
          include: { reviewer: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { started_at: 'desc' },
    });

    const evaluations = await this.prisma.simulationEvaluation.findMany({
      where: { student_id: userId },
      orderBy: { evaluated_at: 'desc' },
    });

    const instanceIds = instances.map((i) => i.id);
    const chatLogCounts = instanceIds.length
      ? await this.prisma.simulationChatLog.groupBy({
          by: ['simulation_instance_id'],
          where: { simulation_instance_id: { in: instanceIds } },
          _count: { _all: true },
        })
      : [];
    const eventosByInstance = new Map(
      chatLogCounts.map((t) => [t.simulation_instance_id, t._count._all]),
    );

    const normalizeKpis = (kpiResults: unknown): Record<string, number> => {
      if (!kpiResults || typeof kpiResults !== 'object') return {};
      const out: Record<string, number> = {};
      for (const [key, val] of Object.entries(kpiResults as Record<string, unknown>)) {
        if (typeof val === 'number') {
          out[key] = val;
        } else if (val && typeof val === 'object' && 'score' in val) {
          out[key] = Number((val as { score: unknown }).score) || 0;
        } else {
          out[key] = Number(val) || 0;
        }
      }
      return out;
    };

    const rubricScoresToKpis = (scores: unknown): Record<string, number> => {
      if (!scores || typeof scores !== 'object') return {};
      const out: Record<string, number> = {};
      for (const [key, val] of Object.entries(scores as Record<string, unknown>)) {
        const level = Number(val) || 0;
        out[key] = level > 0 ? Math.round((level / 4) * 100) : 0;
      }
      return out;
    };

    const enriched = instances.map((inst) => {
      const humanReview = inst.session_rubric_review;
      const evalData = evaluations.find((e) => e.simulation_id === inst.id);
      const totalEventos = eventosByInstance.get(inst.id) ?? 0;

      if (humanReview) {
        const reviewerName = humanReview.reviewer?.name ?? 'Profesor';
        const pct =
          humanReview.max_score > 0
            ? Math.round((humanReview.total_score / humanReview.max_score) * 100)
            : 0;
        const kpis = rubricScoresToKpis(humanReview.scores);
        return {
          simulation_id: inst.id,
          status: inst.status,
          started_at: inst.started_at,
          completed_at: inst.completed_at,
          course_id: inst.course_id,
          course_title: inst.course.title,
          course_category: inst.course.category,
          assessment_id: String(humanReview.id),
          score: pct,
          passed: humanReview.passed,
          criteria_met: {
            kpis,
            scoring_methodology: {
              formula: 'Revisión humana con rúbrica',
              components: {},
              puntaje_base_ia: humanReview.total_score,
              puntaje_motor_reglas: null,
              puntaje_crisis: null,
              ajuste_crisis: 0,
              puntaje_final: humanReview.total_score,
              aprobado: humanReview.passed,
              umbral_aprobacion: humanReview.pass_threshold_snapshot,
              criterios_evaluados: Object.keys(kpis),
              ai_mode: 'scripted' as const,
              total_eventos: totalEventos,
              evaluado_por: reviewerName,
              evaluado_en: humanReview.reviewed_at?.toISOString?.()
                ?? String(humanReview.reviewed_at),
            },
            analysis_detail: {
              strengths: humanReview.comment ? [humanReview.comment] : [],
              areas_to_improve: [],
              recommendations: [],
            },
          },
          assessment_comments: humanReview.comment || null,
          evaluated_at: humanReview.reviewed_at,
          evaluator_name: reviewerName,
          total_logs: totalEventos,
          messages_sent: 0,
        };
      }

      const kpis = evalData?.kpi_results ? normalizeKpis(evalData.kpi_results) : null;
      return {
        simulation_id: inst.id,
        status: inst.status,
        started_at: inst.started_at,
        completed_at: inst.completed_at,
        course_id: inst.course_id,
        course_title: inst.course.title,
        course_category: inst.course.category,
        assessment_id: evalData ? String(evalData.id) : null,
        score: evalData ? Number(evalData.overall_score) : inst.score,
        passed: evalData
          ? Number(evalData.overall_score) >= 70
          : inst.score
            ? inst.score >= 70
            : null,
        criteria_met: evalData
          ? {
              kpis,
              scoring_methodology: {
                formula: 'IA + Motor de Reglas',
                components: {},
                puntaje_base_ia: Number(evalData.overall_score),
                puntaje_motor_reglas: null,
                puntaje_crisis: null,
                ajuste_crisis: 0,
                puntaje_final: Number(evalData.overall_score),
                aprobado: Number(evalData.overall_score) >= 70,
                umbral_aprobacion: 70,
                criterios_evaluados: Object.keys(kpis ?? {}),
                ai_mode:
                  totalEventos > 0 || Number(evalData.overall_score) > 0 ? 'live' : 'scripted',
                total_eventos: totalEventos,
                evaluado_por: 'Sistema',
                evaluado_en:
                  evalData.evaluated_at?.toISOString?.() ?? String(evalData.evaluated_at),
              },
              analysis_detail: {
                strengths: evalData.overall_feedback ? [evalData.overall_feedback] : [],
                areas_to_improve: [],
                recommendations: [],
              },
            }
          : null,
        assessment_comments: evalData?.overall_feedback || null,
        evaluated_at: evalData?.evaluated_at || null,
        evaluator_name: null,
        total_logs: totalEventos,
        messages_sent: 0,
      };
    });

    const humanReviewed = enriched.filter((s) => s.evaluator_name);
    const scoredItems = humanReviewed.length > 0
      ? humanReviewed
      : enriched.filter((s) => s.score != null && Number(s.score) > 0);
    const passedItems = scoredItems.filter((s) => s.passed === true);

    const stats = {
      total_simulations: instances.length,
      total_evaluations: scoredItems.length,
      passed_evaluations: passedItems.length,
      avg_score:
        scoredItems.length > 0
          ? Math.round(
              scoredItems.reduce((a, s) => a + Number(s.score || 0), 0) / scoredItems.length,
            )
          : null,
      approval_rate:
        scoredItems.length > 0
          ? Math.round((passedItems.length / scoredItems.length) * 100)
          : null,
    };

    return { student, stats, simulations: enriched };
  }
}

// ── Simulation Sessions ──────────────────────────────────────────
@Controller('simulation-sessions')
export class SimulationSessionsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    const result = await paginate((this.prisma as any).simulationInstance, {}, {
      page: pagination.page,
      limit: pagination.limit,
      orderBy: { started_at: 'desc' },
      include: {
        student: true,
        scenario: true,
        course: true,
      },
    });

    const instances = result.data as any[];

    // Fetch chat logs for paginated instances in one query
    const instanceIds = instances.map((i: any) => i.id);
    const allChatLogs = instanceIds.length > 0
      ? await (this.prisma as any).simulationChatLog.findMany({
          where: { simulation_instance_id: { in: instanceIds } },
        })
      : [];
    const logsByInstance = new Map<string, any[]>();
    for (const log of allChatLogs) {
      const arr = logsByInstance.get(log.simulation_instance_id) || [];
      arr.push(log);
      logsByInstance.set(log.simulation_instance_id, arr);
    }

    return {
      ...result,
      data: instances.map((inst: any) => {
        const chatLogs = logsByInstance.get(inst.id) || [];
        return {
          id: inst.id,
          status: inst.status,
          score: inst.score || 0,
          started_at: inst.started_at,
          completed_at: inst.completed_at,
          time_spent_seconds: inst.time_spent_seconds || 0,
          progress_percentage: inst.progress_percentage || 0,
          student_name: inst.student ? inst.student.name : 'Unknown',
          student_email: inst.student ? inst.student.email : '',
          student_id: inst.student_id,
          scenario_title: inst.scenario ? inst.scenario.title : 'Unknown',
          scenario_type: inst.scenario ? inst.scenario.scenario_type : '',
          difficulty: inst.scenario ? inst.scenario.difficulty : '',
          course_title: inst.course ? inst.course.title : 'Unknown',
          course_id: inst.course_id,
          total_turns: chatLogs.length,
          incorrect_turns: chatLogs.filter((l: any) => l.is_correct === false).length,
        };
      }),
    };
  }

  @Get('ref/:ref')
  async findByRef(@Param('ref') ref: string) {
    // Find log by ref_number and return the instance
    const log = await (this.prisma as any).simulationChatLog.findFirst({
      where: { ref_number: ref },
    });
    if (!log) return null;
    return this.findOne(log.simulation_instance_id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const inst = await this.prisma.simulationInstance.findUnique({
      where: { id },
      include: {
        student: true,
        scenario: true,
        course: true,
      },
    }) as any;
    if (!inst) return null;

    const chatLogs = await (this.prisma as any).simulationChatLog.findMany({
      where: { simulation_instance_id: id },
      orderBy: { turn_number: 'asc' },
    });

    const submissions = await (this.prisma as any).fileUpload.findMany({
      where: { simulation_instance_id: id, is_active: true },
      orderBy: { created_at: 'desc' },
    });

    const evalData = await this.prisma.simulationEvaluation.findFirst({
      where: { simulation_id: id },
    });

    return {
      instance: {
        id: inst.id,
        status: inst.status,
        score: inst.score || 0,
        started_at: inst.started_at,
        completed_at: inst.completed_at,
        time_spent_seconds: inst.time_spent_seconds || 0,
        progress_percentage: inst.progress_percentage || 0,
        student_name: inst.student ? inst.student.name : 'Unknown',
        student_email: inst.student ? inst.student.email : '',
        student_id: inst.student_id,
        scenario_title: inst.scenario ? inst.scenario.title : 'Unknown',
        scenario_type: inst.scenario ? inst.scenario.scenario_type : '',
        difficulty: inst.scenario ? inst.scenario.difficulty : '',
        course_title: inst.course ? inst.course.title : 'Unknown',
      },
      summary: {
        total_turns: chatLogs.length,
        student_turns: chatLogs.filter((l: any) => l.speaker === 'student').length,
        evaluated_turns: chatLogs.filter((l: any) => l.is_correct !== null && l.is_correct !== undefined).length,
        correct_turns: chatLogs.filter((l: any) => l.is_correct === true).length,
        incorrect_turns: chatLogs.filter((l: any) => l.is_correct === false).length,
      },
      submissions: submissions.map((f: any) => ({
        id: f.id,
        file_name: f.file_name,
        file_type: f.file_type,
        file_size_bytes: f.file_size_bytes?.toString?.() ?? String(f.file_size_bytes),
        created_at: f.created_at,
        download_url: `/files/${f.id}/download`,
      })),
      logs: chatLogs.map((l: any) => ({
        id: l.id,
        turn_number: l.turn_number,
        speaker: l.speaker,
        message_text: l.message,
        is_correct: l.is_correct === true ? 1 : (l.is_correct === false ? 0 : null),
        ref_number: l.ref_number,
        score_impact: 0,
        ai_solution: l.metadata ? (l.metadata as any).ai_solution : null,
        correct_answer: l.metadata ? (l.metadata as any).correct_answer : null,
      })),
      evaluation: evalData ? {
        overall_score: evalData.overall_score || 0,
        overall_feedback: evalData.overall_feedback || '',
        kpi_results: evalData.kpi_results || {},
        completion_percentage: evalData.completion_percentage || 0,
        time_spent_seconds: evalData.time_spent_seconds || 0,
        evaluated_at: evalData.evaluated_at,
      } : null,
    };
  }
}

// ── Certificates ─────────────────────────────────────────────────
@Controller('certificates')
export class CertificatesController {
  constructor(private prisma: PrismaService) {}
  @Get(':id') async findOne(@Param('id') id: string) { return null; }
  @Post('send-email') async sendEmail(@Body() body: any) { return { sent: true }; }
}
