import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CreateTechSheetDto } from './dto/create-tech-sheet.dto';
import { UpdateTechSheetDto } from './dto/update-tech-sheet.dto';
import { UpdateTechSheetConfigDto } from './dto/update-tech-sheet-config.dto';
import { UpdateTechSheetPromptsDto } from './dto/update-tech-sheet-prompts.dto';
import { AnalysisPipelineService } from './analysis-pipeline.service';

@Injectable()
export class TechSheetsService {
  constructor(
    private prisma: PrismaService,
    private analysisPipeline: AnalysisPipelineService,
  ) {}

  async findAll(opts?: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = opts || {};
    return paginate(this.prisma.techSheet, {}, { page, limit, orderBy: { created_at: 'desc' } });
  }

  async findAllDropdown() {
    return this.prisma.techSheet.findMany({ orderBy: { created_at: 'desc' } });
  }

  async findValid() {
    const sheets = await this.prisma.techSheet.findMany({
      orderBy: { created_at: 'desc' },
    });
    return sheets
      .filter((s) => s.name && (s.competencies || s.kpi_requirements))
      .map((s) => ({
        id: s.id,
        name: s.name,
        processed: s.processed,
        has_competencies: !!s.competencies,
        has_kpis: !!s.kpi_requirements,
      }));
  }

  async findOne(id: number) {
    const sheet = await this.prisma.techSheet.findUnique({ where: { id } });
    if (!sheet) {
      throw new NotFoundException('Tech sheet not found');
    }
    return sheet;
  }

  async create(dto: CreateTechSheetDto) {
    // Validate course exists
    const course = await this.prisma.course.findFirst({
      where: { id: dto.course_id },
    });
    if (!course) {
      throw new BadRequestException(
        `Course with ID "${dto.course_id}" does not exist`,
      );
    }

    return this.prisma.techSheet.create({
      data: {
        name: dto.name,
        course_id: dto.course_id,
        ministry_code: dto.ministry_code,
        description: dto.description,
        competencies: dto.competencies,
        kpi_requirements: dto.kpi_requirements,
        context_scenario: dto.context_scenario,
        file_url: dto.file_url,
        uploaded_by: dto.uploaded_by || 'system',
      },
    });
  }

  async update(id: number, dto: UpdateTechSheetDto) {
    await this.findOne(id);
    return this.prisma.techSheet.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.techSheet.delete({ where: { id } });
    return { message: 'Tech sheet deleted successfully' };
  }

  async process(id: number) {
    const sheet = await this.findOne(id);
    return this.prisma.techSheet.update({
      where: { id },
      data: {
        processed: true,
        processed_at: new Date(),
        extracted_data: {
          kpis: sheet.kpi_requirements || [],
          competencies: sheet.competencies || [],
          processed_at: new Date(),
          note: 'Processed manually',
        },
      },
    });
  }

  async analyze(id: number) {
    const sheet = await this.findOne(id);
    if (!sheet.course_id) {
      throw new BadRequestException(
        'Tech sheet must have a course assigned',
      );
    }

    const hasContent = sheet.file_url || sheet.description;
    if (!hasContent) {
      throw new BadRequestException(
        'Tech sheet must have at least one of: attached file, URL, or description',
      );
    }

    // Guard against concurrent pipeline runs
    const activeStatuses = ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6', 'step_7', 'step_8'];
    if (sheet.pipeline_status && activeStatuses.includes(sheet.pipeline_status)) {
      throw new BadRequestException('El análisis ya está en progreso');
    }

    // Reset processed flags so re-analysis starts clean
    await (this.prisma as any).techSheet.update({
      where: { id },
      data: { processed: false, processed_at: null },
    });

    // Fire-and-forget: trigger pipeline without awaiting
    this.analysisPipeline.run(id).catch((error) => {
      console.error(`Pipeline failed for tech sheet ${id}:`, error);
    });

    return {
      message: 'Analysis pipeline triggered',
      sheet_id: id,
      status: 'processing',
    };
  }

  async getConfig(id: number) {
    const sheet = await this.findOne(id);

    // Try relational tables first
    const compCount = await (this.prisma as any).techSheetCompetency.count({
      where: { tech_sheet_id: id },
    });
    if (compCount > 0) {
      return this.getConfigFromTables(id, sheet);
    }

    // Fallback to JSONB parsing (legacy data)
    const extractedData = sheet.extracted_data as Record<string, any> | null;
    const config = extractedData?.analyzed_config;

    if (config) {
      const competencies = this.parseCompetencies(config.competencies);
      const kpis = this.parseKpis(config.kpis);
      const tasks = this.parseQuestions(config.questions);
      // Use saved prompts if the user edited them; otherwise generate defaults
      const savedPrompts = config.prompts || {};
      const prompts = {
        system_prompt:
          savedPrompts.system_prompt || config.simulation_prompt || '',
        coaching_prompt:
          savedPrompts.coaching_prompt ||
          config.coaching_prompt ||
          this.buildCoachingPrompt(competencies, kpis) ||
          '',
      };

      // Link tasks to the first KPI so they appear in the UI
      // (AI generates tasks independently, not linked to specific KPIs)
      if (tasks.length > 0 && kpis.length > 0) {
        const firstKpiId = kpis[0].id;
        for (const task of tasks) {
          task.kpi_id = firstKpiId;
        }
        // Also populate evaluation_questions on the first KPI
        kpis[0].evaluation_questions = tasks.map((t) => t.title);
      }

      // Distribute weights by KPI category priority
      if (kpis.length > 0) {
        const categoryWeights: Record<string, number> = {
          evaluacion: 3,
          desempeño: 2,
          asistencia: 1.5,
          participacion: 1,
        };
        let totalUnits = 0;
        for (const kpi of kpis) {
          if (!kpi.weight || kpi.weight === 0) {
            const cat = (kpi.category || '').toLowerCase();
            const unit = categoryWeights[cat] || 1;
            (kpi as any)._weightUnit = unit;
            totalUnits += unit;
          }
        }
        if (totalUnits > 0) {
          for (const kpi of kpis) {
            if ((kpi as any)._weightUnit) {
              kpi.weight =
                Math.round(((kpi as any)._weightUnit / totalUnits) * 1000) /
                10;
              delete (kpi as any)._weightUnit;
            }
          }
        }
      }

      return {
        competencies,
        kpis,
        tasks,
        prompts,
        pipeline_status: sheet.pipeline_status,
        pipeline_output: this.getPipelineAssets(sheet),
      };
    }

    // Return empty skeleton when no config exists yet
    return {
      competencies: [],
      kpis: [],
      tasks: [],
      prompts: {},
      pipeline_status: sheet.pipeline_status,
      pipeline_output: this.getPipelineAssets(sheet),
    };
  }

  /**
   * Extract step_8_emails, step_9_spreadsheet, step_10_crisis from pipeline_output JSONB.
   * Returns null for each if absent.
   */
  private getPipelineAssets(sheet: any): {
    step_8_emails: any;
    step_9_spreadsheet: any;
    step_10_crisis: any;
  } {
    const po = (sheet.pipeline_output || {}) as Record<string, any>;
    return {
      step_8_emails: po.step_8_emails ?? null,
      step_9_spreadsheet: po.step_9_spreadsheet ?? null,
      step_10_crisis: po.step_10_crisis ?? null,
    };
  }

  /**
   * Read config from relational tables. Returns the same shape as JSONB fallback.
   */
  private async getConfigFromTables(
    id: number,
    sheet: any,
  ) {
    const pipeline_status = sheet.pipeline_status;
    const competencies = await (this.prisma as any).techSheetCompetency.findMany({
      where: { tech_sheet_id: id },
      orderBy: { created_at: 'asc' },
    });
    const kpis = await (this.prisma as any).techSheetKPI.findMany({
      where: { tech_sheet_id: id },
      include: { tasks: true },
      orderBy: { created_at: 'asc' },
    });
    const prompts = await (this.prisma as any).techSheetPrompt.findMany({
      where: { tech_sheet_id: id },
    });

    // All tasks for the sheet (including orphans without kpi_id)
    const allTasks = await (this.prisma as any).techSheetTask.findMany({
      where: { tech_sheet_id: id },
      orderBy: { sequence: 'asc' },
    });

    return {
      competencies: competencies.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        level: c.level,
      })),
      kpis: kpis.map((k: any) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        category: k.category,
        weight: k.weight,
        target_value: k.target_value,
        minimum_pass_value: k.minimum_pass_value,
        competencies_required: [],
        evaluation_questions: (k.tasks || []).map((t: any) => t.title),
      })),
      tasks: allTasks.map((t: any) => ({
        id: t.id,
        kpi_id: t.kpi_id || '',
        type: 'practice',
        title: t.title,
        description: t.description,
        difficulty: this.mapDifficulty(t.difficulty),
        sequence: t.sequence,
        expected_duration_minutes: t.expected_duration_minutes,
      })),
      prompts: {
        system_prompt: prompts.find((p: any) => p.type === 'system')?.content || '',
        coaching_prompt: prompts.find((p: any) => p.type === 'coaching')?.content || '',
      },
      pipeline_status,
      pipeline_output: this.getPipelineAssets(sheet),
    };
  }

  private safeParseJson(value: any): any {
    if (!value) return null;
    if (typeof value === 'string') {
      // Strip markdown code fences (```json / ```) that AI responses wrap JSON in
      let cleaned = value.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
      cleaned = cleaned.replace(/\n?\s*```$/, '');
      try {
        return JSON.parse(cleaned);
      } catch {
        return null;
      }
    }
    return value;
  }

  private uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private parseCompetencies(raw: any): any[] {
    const parsed = this.safeParseJson(raw);
    if (!parsed) return [];

    // Handle { competencias: [...] } wrapper
    const items = Array.isArray(parsed) ? parsed : parsed.competencias || parsed.competencies || [];
    if (!Array.isArray(items)) return [];

    return items.map((c: any) => ({
      id: this.uuid(),
      name: c.nombre || c.name || '',
      description: c.descripcion || c.description || '',
      level: this.mapLevel(c.nivel || c.level),
    }));
  }

  private mapLevel(raw: string): 'basic' | 'intermediate' | 'advanced' {
    const map: Record<string, 'basic' | 'intermediate' | 'advanced'> = {
      basico: 'basic',
      basica: 'basic',
      intermedio: 'intermediate',
      intermedia: 'intermediate',
      avanzado: 'advanced',
      avanzada: 'advanced',
      basic: 'basic',
      intermediate: 'intermediate',
      advanced: 'advanced',
    };
    return map[String(raw).toLowerCase()] || 'basic';
  }

  private parseKpis(raw: any): any[] {
    const parsed = this.safeParseJson(raw);
    if (!parsed) return [];

    const items = Array.isArray(parsed) ? parsed : parsed.kpis || [];
    if (!Array.isArray(items)) return [];

    return items.map((k: any) => ({
      id: this.uuid(),
      name: k.nombre || k.name || '',
      description: k.descripcion || k.description || '',
      category: k.categoria || k.category || 'desempeño',
      weight: this.toNumber(k.weight || k.peso),
      target_value: this.toNumber(k.valor_objetivo || k.target_value),
      minimum_pass_value: this.extractPercentage(k.criterio_aprobacion) || this.toNumber(k.minimum_pass_value),
      competencies_required: Array.isArray(k.competencias_required) ? k.competencias_required : [],
      evaluation_questions: Array.isArray(k.evaluation_questions) ? k.evaluation_questions : [],
    }));
  }

  private extractPercentage(text: string): number {
    if (!text) return 0;
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (match) return parseFloat(match[1].replace(',', '.'));
    return 0;
  }

  private toNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Extract first number from strings like "80%", "6 puntos", "120 horas cátedra", "18 años"
    const str = String(val);
    const match = str.match(/(\d+(?:[.,]\d+)?)/);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }
    return 0;
  }

  private parseQuestions(raw: any): any[] {
    const parsed = this.safeParseJson(raw);
    if (!parsed) return [];

    // Handle { preguntas: [...] } wrapper
    const items = Array.isArray(parsed) ? parsed : parsed.preguntas || parsed.questions || [];
    if (!Array.isArray(items)) return [];

    return items.map((q: any, i: number) => ({
      id: this.uuid(),
      kpi_id: '',
      type: this.mapTaskType(q.tipo || q.type),
      title: q.texto || q.text || q.titulo || '',
      description: q.descripcion || q.description || '',
      difficulty: this.mapDifficulty(q.dificultad || q.difficulty),
      sequence: i + 1,
      expected_duration_minutes: 0,
    }));
  }

  private mapTaskType(_raw: string): 'practice' {
    return 'practice';
  }

  /** Align with course practices: very_low | low | medium (never hard). */
  private mapDifficulty(raw: string): 'very_low' | 'low' | 'medium' {
    const key = String(raw || '').toLowerCase().trim();
    const map: Record<string, 'very_low' | 'low' | 'medium'> = {
      basica: 'very_low',
      basico: 'very_low',
      easy: 'very_low',
      very_low: 'very_low',
      very_easy: 'very_low',
      'muy baja': 'very_low',
      intermedia: 'low',
      intermedio: 'low',
      low: 'low',
      baja: 'low',
      avanzada: 'medium',
      avanzado: 'medium',
      medium: 'medium',
      media: 'medium',
      hard: 'medium',
    };
    return map[key] || 'very_low';
  }

  /**
   * Build a default coaching prompt from parsed competencies and KPIs.
   * Used as fallback when the user hasn't saved their own coaching prompt yet.
   */
  private buildCoachingPrompt(
    competencies: any[],
    kpis: any[],
  ): string {
    if (!competencies.length && !kpis.length) return '';

    const compNames = competencies
      .map((c) => `- ${c.name} (${c.level})`)
      .filter(Boolean)
      .join('\n');

    const kpiNames = kpis
      .map((k) => `- ${k.name}`)
      .filter(Boolean)
      .join('\n');

    return [
      'Actúa como coach del estudiante. Tu rol es guiar, no dar respuestas directas.',
      '',
      compNames ? 'Competencias que el estudiante debe desarrollar:' : '',
      compNames || '',
      '',
      kpiNames ? 'Indicadores que el estudiante debe alcanzar:' : '',
      kpiNames || '',
      '',
      'Reglas de coaching:',
      '- Da pistas, no soluciones completas.',
      '- Haz preguntas que lleven al estudiante a reflexionar.',
      '- Reconoce aciertos antes de señalar errores.',
      '- Si el estudiante se bloquea, ofrece un ejemplo relacionado.',
      '- Mantén un tono alentador y constructivo.',
      'Responde en español.',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  async updateConfig(id: number, dto: UpdateTechSheetConfigDto) {
    const sheet = await this.findOne(id);
    const extractedData = (sheet.extracted_data as Record<string, any>) || {};

    // Merge config into extracted_data.analyzed_config, preserving other keys
    const mergedConfig = {
      ...extractedData.analyzed_config,
      ...(dto.competencies !== undefined && { competencies: dto.competencies }),
      ...(dto.kpis !== undefined && { kpis: dto.kpis }),
      ...(dto.tasks !== undefined && { tasks: dto.tasks }),
      ...(dto.prompts !== undefined && { prompts: dto.prompts }),
    };

    const updatedExtractedData = {
      ...extractedData,
      analyzed_config: mergedConfig,
    };

    // Write to relational tables in a transaction
    await (this.prisma as any).$transaction(async (tx: any) => {
      // Sync Competencies
      if (dto.competencies !== undefined) {
        const existingComps =
          (await tx.techSheetCompetency.findMany({
            where: { tech_sheet_id: id },
          })) || [];
        const incomingCompIds = new Set(
          (dto.competencies || []).map((c: any) => c.id).filter(Boolean),
        );
        const compsToDelete = existingComps
          .filter((c: any) => !incomingCompIds.has(c.id))
          .map((c: any) => c.id);

        if (compsToDelete.length > 0) {
          await tx.techSheetCompetency.deleteMany({
            where: { id: { in: compsToDelete } },
          });
        }

        for (const c of dto.competencies || []) {
          const compData = {
            tech_sheet_id: id,
            name: c.name || '',
            description: c.description || '',
            level: c.level || 'basic',
            category: c.category || 'tecnica',
          };
          if (c.id && existingComps.some((e: any) => e.id === c.id)) {
            await tx.techSheetCompetency.update({
              where: { id: c.id },
              data: compData,
            });
          } else {
            await tx.techSheetCompetency.create({
              data: c.id ? { ...compData, id: c.id } : compData,
            });
          }
        }
      }

      // Sync KPIs
      const kpiIds: string[] = [];
      if (dto.kpis !== undefined) {
        const existingKpis =
          (await tx.techSheetKPI.findMany({
            where: { tech_sheet_id: id },
          })) || [];
        const incomingKpiIds = new Set(
          (dto.kpis || []).map((k: any) => k.id).filter(Boolean),
        );
        const kpisToDelete = existingKpis
          .filter((k: any) => !incomingKpiIds.has(k.id))
          .map((k: any) => k.id);

        if (kpisToDelete.length > 0) {
          await tx.techSheetKPI.deleteMany({
            where: { id: { in: kpisToDelete } },
          });
        }

        for (const k of dto.kpis || []) {
          const kpiData = {
            tech_sheet_id: id,
            name: k.name || '',
            description: k.description || '',
            category: k.category || 'desempeño',
            weight: k.weight ?? 0,
            target_value: k.target_value ?? 0,
            minimum_pass_value: k.minimum_pass_value ?? 0,
          };
          let kpiId = k.id;
          if (k.id && existingKpis.some((e: any) => e.id === k.id)) {
            const updated = await tx.techSheetKPI.update({
              where: { id: k.id },
              data: kpiData,
            });
            kpiId = updated.id;
          } else {
            const created = await tx.techSheetKPI.create({
              data: k.id ? { ...kpiData, id: k.id } : kpiData,
            });
            kpiId = created?.id || k.id;
          }
          kpiIds.push(kpiId);
        }
      }

      // Sync Tasks (Preserves UUIDs!)
      if (dto.tasks !== undefined) {
        const existingTasks =
          (await tx.techSheetTask.findMany({
            where: { tech_sheet_id: id },
          })) || [];
        const firstKpiId = kpiIds[0] || existingTasks[0]?.kpi_id || null;
        const incomingTaskIds = new Set(
          (dto.tasks || []).map((t: any) => t.id).filter(Boolean),
        );
        const tasksToDelete = existingTasks
          .filter((t: any) => !incomingTaskIds.has(t.id))
          .map((t: any) => t.id);

        if (tasksToDelete.length > 0) {
          await tx.techSheetTask.deleteMany({
            where: { id: { in: tasksToDelete } },
          });
        }

        for (let i = 0; i < (dto.tasks || []).length; i++) {
          const t = dto.tasks[i];
          const taskData = {
            tech_sheet_id: id,
            kpi_id: firstKpiId,
            type: 'practice' as const,
            title: t.title || '',
            description: t.description || '',
            difficulty: this.mapDifficulty(t.difficulty || 'medium'),
            sequence: t.sequence || i + 1,
            expected_duration_minutes: t.expected_duration_minutes ?? 0,
          };

          if (t.id && existingTasks.some((e: any) => e.id === t.id)) {
            await tx.techSheetTask.update({
              where: { id: t.id },
              data: taskData,
            });
          } else {
            await tx.techSheetTask.create({
              data: t.id ? { ...taskData, id: t.id } : taskData,
            });
          }
        }
      }

      // Sync Prompts
      if (dto.prompts) {
        await tx.techSheetPrompt.deleteMany({ where: { tech_sheet_id: id } });
        const promptTypes = ['system', 'coaching'] as const;
        for (const type of promptTypes) {
          const key = type === 'system' ? 'system_prompt' : 'coaching_prompt';
          const content = dto.prompts[key];
          if (content) {
            await tx.techSheetPrompt.create({
              data: {
                tech_sheet_id: id,
                type,
                content,
              },
            });
          }
        }
      }
    });

    // Also update JSONB for backward compat (read-only fallback)
    const updateData: any = { extracted_data: updatedExtractedData };

    // Merge pipeline_output assets from DTO (steps 8-10) preserving other pipeline keys
    if (dto.pipeline_output) {
      const currentPO = (sheet.pipeline_output || {}) as Record<string, any>;
      updateData.pipeline_output = {
        ...currentPO,
        ...dto.pipeline_output,
      };
    }

    const updated = await (this.prisma as any).techSheet.update({
      where: { id },
      data: updateData,
    });

    // Keep course practices in sync when tasks were part of the save
    if (dto.tasks !== undefined) {
      try {
        await this.analysisPipeline.syncPracticesToCourse(id);
      } catch (err) {
        // Non-blocking: config save succeeded even if practice materialization fails
        console.warn(`Practice sync after config update failed for sheet ${id}:`, err);
      }
    }

    return updated;
  }

  /**
   * Update only system/coaching prompts (+ optional CourseConfig fields used at runtime).
   * Does not wipe competencies/KPIs/tasks.
   */
  async updatePrompts(id: number, dto: UpdateTechSheetPromptsDto) {
    const sheet = await this.findOne(id);

    const systemPrompt =
      dto.system_prompt !== undefined ? dto.system_prompt : undefined;
    const coachingPrompt =
      dto.coaching_prompt !== undefined ? dto.coaching_prompt : undefined;

    // Single transaction: techSheetPrompt + extracted_data + CourseConfig sync.
    // If any step fails, nothing is persisted — no more partial saves.
    await (this.prisma as any).$transaction(async (tx: any) => {
      if (systemPrompt !== undefined) {
        await tx.techSheetPrompt.upsert({
          where: {
            tech_sheet_id_type: { tech_sheet_id: id, type: 'system' },
          },
          update: { content: systemPrompt },
          create: { tech_sheet_id: id, type: 'system', content: systemPrompt },
        });
      }
      if (coachingPrompt !== undefined) {
        await tx.techSheetPrompt.upsert({
          where: {
            tech_sheet_id_type: { tech_sheet_id: id, type: 'coaching' },
          },
          update: { content: coachingPrompt },
          create: {
            tech_sheet_id: id,
            type: 'coaching',
            content: coachingPrompt,
          },
        });
      }

      // Keep JSONB analyzed_config.prompts in sync when present
      const extractedData = (sheet.extracted_data as Record<string, any>) || {};
      if (extractedData.analyzed_config || systemPrompt !== undefined || coachingPrompt !== undefined) {
        const prevPrompts = extractedData.analyzed_config?.prompts || {};
        const updatedExtractedData = {
          ...extractedData,
          analyzed_config: {
            ...(extractedData.analyzed_config || {}),
            prompts: {
              ...prevPrompts,
              ...(systemPrompt !== undefined && { system_prompt: systemPrompt }),
              ...(coachingPrompt !== undefined && { coaching_prompt: coachingPrompt }),
            },
          },
        };
        await tx.techSheet.update({
          where: { id },
          data: { extracted_data: updatedExtractedData },
        });
      }

      // Sync CourseConfig used by simulation chat (if course linked)
      if (sheet.course_id) {
        const existingPrompts = await tx.techSheetPrompt.findMany({
          where: { tech_sheet_id: id },
        });
        const sys =
          systemPrompt ??
          existingPrompts.find((p: any) => p.type === 'system')?.content ??
          '';
        const coach =
          coachingPrompt ??
          existingPrompts.find((p: any) => p.type === 'coaching')?.content ??
          '';

        const existingConfig = await tx.courseConfig.findUnique({
          where: { course_id: sheet.course_id },
        });
        const prevIa =
          existingConfig?.ia_config && typeof existingConfig.ia_config === 'object'
            ? existingConfig.ia_config
            : {};

        const configData = {
          ia_config: {
            ...prevIa,
            systemPrompt: sys,
            coachingPrompt: coach,
            temperature: prevIa.temperature ?? 0.7,
            maxTokens: prevIa.maxTokens ?? 4000,
          },
          tech_sheet_id: id,
          prompt_generation_mode: 'guided' as const,
          prompt_generated_at: new Date(),
          ...(dto.base_role !== undefined && { base_role: dto.base_role }),
          ...(dto.course_context !== undefined && { course_context: dto.course_context }),
          ...(dto.knowledge_base_prompt !== undefined && {
            knowledge_base_prompt: dto.knowledge_base_prompt,
          }),
        };

        await tx.courseConfig.upsert({
          where: { course_id: sheet.course_id },
          update: configData,
          create: {
            course_id: sheet.course_id,
            config_data: {
              source: 'prompt_editor',
              sheet_id: id,
              generated_at: new Date().toISOString(),
            },
            ...configData,
          },
        });
      }
    });

    return this.getConfig(id);
  }
}
