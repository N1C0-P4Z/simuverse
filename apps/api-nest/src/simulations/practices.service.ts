import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from './ai/ai.service';
import { SessionMemoryService } from './session-memory.service';
import { SessionCheckpointService } from './session-checkpoint.service';

const DIFFICULTY_LABELS: Record<string, string> = {
  very_low: 'muy baja',
  low: 'baja',
  medium: 'media',
  easy: 'baja',
  hard: 'media',
};

@Injectable()
export class PracticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
    private readonly sessionMemory: SessionMemoryService,
    private readonly checkpoint: SessionCheckpointService,
  ) {}

  /** Normalize sequence_index and agent_key for legacy scenarios treated as practices. */
  private normalizePracticeScenarios<T extends { sequence_index: number; agent_key: string | null }>(
    scenarios: T[],
  ): T[] {
    return scenarios.map((s, index) => {
      const sequenceIndex = s.sequence_index > 0 ? s.sequence_index : index + 1;
      return {
        ...s,
        sequence_index: sequenceIndex,
        agent_key: s.agent_key || `practica-${sequenceIndex}`,
      };
    });
  }

  private practiceWhere(courseId: string) {
    return {
      course_id: courseId,
      is_active: true,
      OR: [
        { scenario_type: 'practice' },
        { agent_key: { startsWith: 'practica-' } },
      ],
    };
  }

  async listByCourse(courseId: string) {
    const explicit = await this.prisma.scenario.findMany({
      where: this.practiceWhere(courseId),
      orderBy: { sequence_index: 'asc' },
    });

    if (explicit.length > 0) {
      return this.normalizePracticeScenarios(explicit);
    }

    const legacy = await this.prisma.scenario.findMany({
      where: { course_id: courseId, is_active: true },
      orderBy: { sequence_index: 'asc' },
    });

    return this.normalizePracticeScenarios(legacy);
  }

  /** Paginated list for admin ABM. Internal flows keep using listByCourse (full). */
  async listByCoursePaginated(courseId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const explicitWhere = this.practiceWhere(courseId);
    const explicitTotal = await this.prisma.scenario.count({ where: explicitWhere });

    if (explicitTotal > 0) {
      const rows = await this.prisma.scenario.findMany({
        where: explicitWhere,
        orderBy: { sequence_index: 'asc' },
        skip,
        take: safeLimit,
      });
      return {
        data: this.normalizePracticeScenarios(rows),
        total: explicitTotal,
        page: safePage,
        limit: safeLimit,
      };
    }

    const legacyWhere = { course_id: courseId, is_active: true };
    const [rows, total] = await Promise.all([
      this.prisma.scenario.findMany({
        where: legacyWhere,
        orderBy: { sequence_index: 'asc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.scenario.count({ where: legacyWhere }),
    ]);

    return {
      data: this.normalizePracticeScenarios(rows),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  private async getCompletedScenarioIds(
    studentId: string,
    courseId: string,
  ): Promise<Set<string>> {
    const completed = await this.prisma.simulationInstance.findMany({
      where: {
        student_id: studentId,
        course_id: courseId,
        status: { in: ['completed', 'submitted_for_review'] },
      },
      select: { scenario_id: true },
    });
    return new Set(completed.map((c) => c.scenario_id));
  }

  isPracticeUnlocked(
    practice: { id: string; sequence_index: number },
    practices: Array<{ id: string; sequence_index: number }>,
    completedIds: Set<string>,
  ): boolean {
    if (practice.sequence_index <= 1) return true;
    const prev = practices.find((p) => p.sequence_index === practice.sequence_index - 1);
    return !!prev && completedIds.has(prev.id);
  }

  async getStudentProgress(studentId: string, courseId: string) {
    const practices = await this.listByCourse(courseId);
    const instances = await this.prisma.simulationInstance.findMany({
      where: { student_id: studentId, course_id: courseId },
      orderBy: { started_at: 'desc' },
    });

    const byScenario = new Map<string, (typeof instances)[0]>();
    for (const inst of instances) {
      if (!byScenario.has(inst.scenario_id)) {
        byScenario.set(inst.scenario_id, inst);
      }
    }

    const completedIds = await this.getCompletedScenarioIds(studentId, courseId);

    let nextPracticeId: string | null = null;
    const items = practices.map((p) => {
      const unlocked = this.isPracticeUnlocked(p, practices, completedIds);
      const inst = byScenario.get(p.id);
      const completed = completedIds.has(p.id);
      const inProgress =
        inst?.status === 'in_progress' || inst?.status === 'paused';

      let status: 'locked' | 'available' | 'in_progress' | 'completed';
      if (completed) status = 'completed';
      else if (inProgress) status = 'in_progress';
      else if (unlocked) status = 'available';
      else status = 'locked';

      if (!nextPracticeId && (status === 'available' || status === 'in_progress')) {
        nextPracticeId = p.id;
      }

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        agent_key: p.agent_key || `practica-${p.sequence_index}`,
        sequence_index: p.sequence_index,
        difficulty: p.difficulty,
        difficulty_label: this.difficultyLabel(p.difficulty),
        status,
        unlocked,
        instance_id:
          status === 'in_progress' || status === 'completed' ? inst?.id : undefined,
      };
    });

    return {
      practices: items,
      next_practice_id: nextPracticeId,
      total: practices.length,
      completed_count: completedIds.size,
    };
  }

  async createPractice(
    courseId: string,
    data: {
      title: string;
      description?: string;
      difficulty?: 'very_low' | 'low' | 'medium';
      content?: any;
    },
  ) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const last = await this.prisma.scenario.findFirst({
      where: { course_id: courseId },
      orderBy: { sequence_index: 'desc' },
    });
    const sequence = (last?.sequence_index ?? 0) + 1;
    const agentKey = `practica-${sequence}`;

    return this.prisma.scenario.create({
      data: {
        course_id: courseId,
        title: data.title,
        description: data.description,
        scenario_type: 'practice',
        difficulty: data.difficulty || 'medium',
        content: data.content ?? {},
        sequence_index: sequence,
        agent_key: agentKey,
        is_active: true,
      },
    });
  }

  async updatePractice(
    id: string,
    data: {
      title?: string;
      description?: string;
      difficulty?: 'very_low' | 'low' | 'medium';
      content?: any;
      is_active?: boolean;
    },
  ) {
    await this.findPractice(id);
    return this.prisma.scenario.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        content: data.content,
        is_active: data.is_active,
      },
    });
  }

  async findPractice(id: string) {
    const practice = await this.prisma.scenario.findUnique({ where: { id } });
    if (!practice) throw new NotFoundException('Practice not found');
    return practice;
  }

  /**
   * Start or resume the next unlocked practice for a student.
   */
  async startNextPractice(
    studentId: string,
    courseId: string,
    scenarioId?: string,
  ) {
    const practices = await this.listByCourse(courseId);
    if (practices.length === 0) {
      throw new BadRequestException('No hay prácticas configuradas para este curso');
    }

    const completedIds = await this.getCompletedScenarioIds(studentId, courseId);

    let next = scenarioId
      ? practices.find((p) => p.id === scenarioId)
      : practices.find((p) => !completedIds.has(p.id));

    if (scenarioId && !next) {
      throw new NotFoundException('Práctica no encontrada en este curso');
    }

    if (!next) {
      // All practices completed — resume the last one for review/replay
      next = practices[practices.length - 1];
    }

    if (
      scenarioId &&
      !this.isPracticeUnlocked(next, practices, completedIds) &&
      !completedIds.has(next.id)
    ) {
      throw new ForbiddenException(
        'Debés completar la práctica anterior antes de continuar',
      );
    }

    // Resume in-progress instance if any
    const active = await this.prisma.simulationInstance.findFirst({
      where: {
        student_id: studentId,
        scenario_id: next.id,
        status: { in: ['in_progress', 'paused'] },
      },
    });
    if (active) {
      await this.checkpoint.hydrateSession(active.id);
      return { instance: active, practice: next, resumed: true };
    }

    // Prior context from previous practice summary
    let priorContext = next.prior_context || '';
    if (next.sequence_index > 1) {
      const prev = practices.find((p) => p.sequence_index === next.sequence_index - 1);
      if (prev) {
        const prevInstance = await this.prisma.simulationInstance.findFirst({
          where: {
            student_id: studentId,
            scenario_id: prev.id,
            status: { in: ['completed', 'submitted_for_review'] },
          },
          orderBy: { completed_at: 'desc' },
        });
        if (prevInstance?.practice_summary) {
          priorContext = prevInstance.practice_summary;
        }
      }
    }

    const instance = await this.prisma.simulationInstance.create({
      data: {
        student_id: studentId,
        course_id: courseId,
        scenario_id: next.id,
        status: 'in_progress',
        progress_percentage: 0,
        session_state: priorContext
          ? { prior_context: priorContext }
          : undefined,
      },
    });

    this.checkpoint.startPeriodicCheckpoint(instance.id);
    return { instance, practice: next, resumed: false, prior_context: priorContext };
  }

  /**
   * Generate structured encore_summary for session recall.
   * Writes to session_state.encore_summary. Non-blocking on failure.
   */
  async generateEncoreSummary(instanceId: string): Promise<void> {
    const instance = await this.prisma.simulationInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance) return;

    const recentTurns = this.sessionMemory.getRecentTurns(instanceId, 20);
    if (recentTurns.length < 2) return;

    const turnsText = recentTurns
      .map((t) => `${t.speaker}: ${t.message}`)
      .join('\n');

    let encoreSummary = '';
    try {
      const result = await this.ai.sendMessage(
        `Resumí la sesión de práctica profesionalizante.\n\nTURNOS RECIENTES:\n${turnsText}`,
        'Sos un asistente que resume sesiones de práctica profesionalizante. Devolvé SOLO un JSON con: topics[], decisions[], progress_note.',
      );
      encoreSummary = result.response;
    } catch {
      try {
        const fallbackResult = await this.ai.sendMessage(
          `Resumí la sesión de práctica profesionalizante.\n\nTURNOS RECIENTES:\n${turnsText}`,
          'Sos un asistente que resume sesiones de práctica profesionalizante. Devolvé SOLO un JSON con: topics[], decisions[], progress_note.',
          [],
          undefined,
          true,
        );
        encoreSummary = fallbackResult.response;
      } catch {
        // keep empty
      }
    }

    if (encoreSummary) {
      const existingState = (instance.session_state as Record<string, any>) || {};
      await this.prisma.simulationInstance.update({
        where: { id: instanceId },
        data: {
          session_state: {
            ...existingState,
            encore_summary: encoreSummary,
          },
        },
      });
    }
  }

  async completePractice(studentId: string, instanceId: string) {
    const instance = await this.prisma.simulationInstance.findUnique({
      where: { id: instanceId },
      include: { scenario: true },
    });
    if (!instance) throw new NotFoundException('Instance not found');
    if (instance.student_id !== studentId) {
      throw new ForbiddenException('Not your practice session');
    }

    await this.checkpoint.checkpointAndClose(instanceId);

    const turns = await this.sessionMemory.getHistory(instanceId);
    const transcript = turns
      .slice(-30)
      .map((t) => `${t.speaker}: ${t.message}`)
      .join('\n');

    let summary = `Práctica ${instance.scenario.agent_key || instance.scenario.title} completada.`;
    try {
      const result = await this.ai.sendMessage(
        `Resumí en 5-8 oraciones (español) lo que el alumno practicó y logró en esta sesión. Sin calificar ni puntuar.\n\nTRANSCRIPTO:\n${transcript}`,
        'Sos un asistente que resume prácticas profesionalizantes. Solo hechos y aprendizajes, sin evaluación.',
      );
      summary = result.response;
    } catch {
      // keep default summary
    }

    // Generate structured encore_summary for session recall on resume
    await this.generateEncoreSummary(instanceId);

    // Re-read to get the encore_summary written by generateEncoreSummary
    const refreshed = await this.prisma.simulationInstance.findUnique({
      where: { id: instanceId },
    });
    const updated = await this.prisma.simulationInstance.update({
      where: { id: instanceId },
      data: {
        status: 'completed',
        completed_at: new Date(),
        progress_percentage: 100,
        practice_summary: summary,
        session_state: refreshed?.session_state ?? undefined,
      },
    });

    this.sessionMemory.invalidate(instanceId);

    // Check if all practices are now completed
    const practices = await this.listByCourse(instance.course_id);
    const completedIds = await this.getCompletedScenarioIds(studentId, instance.course_id);
    const allCompleted = practices.every((p) => completedIds.has(p.id));

    return { instance: updated, summary, all_completed: allCompleted };
  }

  difficultyLabel(difficulty?: string | null): string {
    if (!difficulty) return 'media';
    return DIFFICULTY_LABELS[difficulty] || difficulty;
  }

  async getPracticePromptExtras(instanceId: string): Promise<{
    agent_key?: string;
    difficulty?: string;
    practice_title?: string;
    practice_context?: string;
    prior_context?: string;
  }> {
    const instance = await this.prisma.simulationInstance.findUnique({
      where: { id: instanceId },
      include: { scenario: true },
    });
    if (!instance) return {};

    const sessionState = instance.session_state as { prior_context?: string; encore_summary?: string } | null;
    let prior = sessionState?.prior_context || instance.scenario.prior_context || '';

    // Blend encore_summary from previous session close into prior_context
    const encoreSummary = sessionState?.encore_summary;
    if (encoreSummary) {
      prior = prior ? `${prior}\n\nResumen de la sesión anterior:\n${encoreSummary}` : `Resumen de la sesión anterior:\n${encoreSummary}`;
    }

    if (!prior && instance.scenario.sequence_index > 1) {
      const prev = await this.prisma.scenario.findFirst({
        where: {
          course_id: instance.course_id,
          sequence_index: instance.scenario.sequence_index - 1,
        },
      });
      if (prev) {
        const prevInst = await this.prisma.simulationInstance.findFirst({
          where: {
            student_id: instance.student_id,
            scenario_id: prev.id,
            status: { in: ['completed', 'submitted_for_review'] },
          },
          orderBy: { completed_at: 'desc' },
        });
        prior = prevInst?.practice_summary || '';
      }
    }

    return {
      agent_key: instance.scenario.agent_key || `practica-${instance.scenario.sequence_index}`,
      difficulty: this.difficultyLabel(instance.scenario.difficulty),
      practice_title: instance.scenario.title,
      practice_context: instance.scenario.description || (instance.scenario.content as any)?.system_prompt_excerpt || (instance.scenario.content as any)?.context || '',
      prior_context: prior || undefined,
    };
  }
}
