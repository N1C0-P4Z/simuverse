import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { AIService } from '../simulations/ai/ai.service';
import {
  CreateMinistryRequirementDto,
  UpdateMinistryRequirementDto,
  CreateKpiDto,
  ProcessRequirementDto,
} from './dto/ministry.dto';

@Injectable()
export class MinistryService {
  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
  ) {}

  private serialize<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ));
  }

  // ── Ministry Requirements ──────────────────────────────────────────

  async listRequirements(params: {
    course_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, ...filters } = params;
    const where: any = {};
    if (filters.course_id) where.course_id = filters.course_id;
    if (filters.status) where.status = filters.status;

    const result = await paginate(this.prisma.ministryRequirement, where, {
      page,
      limit,
      orderBy: { created_at: 'desc' },
    });

    return { ...result, data: this.serialize(result.data) };
  }

  async getRequirement(id: string) {
    const requirement = await this.prisma.ministryRequirement.findUnique({
      where: { id },
      include: { kpis: true },
    });
    if (!requirement) return null;
    return this.serialize(requirement);
  }

  async createRequirement(dto: CreateMinistryRequirementDto) {
    const created = await this.prisma.ministryRequirement.create({
      data: {
        course_id: dto.course_id,
        uploaded_by_id: dto.uploaded_by_id,
        file_name: dto.file_name,
        file_type: dto.file_type,
        file_size_bytes: BigInt(dto.file_size_bytes),
        file_path: dto.file_path,
        raw_text: dto.raw_text,
        status: 'uploaded',
      },
    });

    return this.serialize(created);
  }

  async updateRequirement(id: string, dto: UpdateMinistryRequirementDto) {
    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.raw_text !== undefined) data.raw_text = dto.raw_text;
    if (dto.extracted_content !== undefined) data.extracted_content = dto.extracted_content;
    if (dto.processing_notes !== undefined) data.processing_notes = dto.processing_notes;
    if (dto.kpis_generated !== undefined) data.kpis_generated = dto.kpis_generated;
    if (dto.tasks_generated !== undefined) data.tasks_generated = dto.tasks_generated;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    const updated = await this.prisma.ministryRequirement.update({
      where: { id },
      data,
    });

    return this.serialize(updated);
  }

  async processRequirement(id: string, dto: ProcessRequirementDto) {
    // Set status to processing
    await this.prisma.ministryRequirement.update({
      where: { id },
      data: { status: 'processing' },
    });

    const requirement = await this.prisma.ministryRequirement.findUnique({ where: { id } });
    if (!requirement) throw new Error('Requirement not found');

    if (dto.extracted_kpis && Array.isArray(dto.extracted_kpis)) {
      const savedKpis: any[] = [];
      for (const kpiData of dto.extracted_kpis) {
        const kpi = await this.prisma.kPI.create({
          data: {
            course_id: requirement.course_id,
            ministry_requirement_id: requirement.id,
            name: kpiData.name,
            description: kpiData.description || '',
            category: kpiData.category || 'general',
            weight: kpiData.weight || 1.0,
            target_value: kpiData.target_value || 100,
            minimum_pass_value: kpiData.minimum_pass_value || 80,
            thresholds: { excellent: 95, good: 85, acceptable: 75, poor: 0 },
            prompt_instruction: kpiData.prompt_instruction || null,
            trigger_event: kpiData.trigger_event || 'generic',
            is_active: true,
          },
        });
        savedKpis.push(kpi);
      }

      await this.prisma.ministryRequirement.update({
        where: { id },
        data: {
          kpis_generated: savedKpis.length,
          tasks_generated: 0,
          status: 'extracted',
        },
      });

      return { message: 'KPIs extraídos correctamente', kpis: this.serialize(savedKpis) };
    }

    return { message: 'Procesamiento iniciado' };
  }

  async activateRequirement(id: string) {
    const updated = await this.prisma.ministryRequirement.update({
      where: { id },
      data: {
        status: 'active',
        activated_at: new Date(),
        is_active: true,
      },
    });
    return this.serialize(updated);
  }

  async archiveRequirement(id: string) {
    await this.prisma.ministryRequirement.update({
      where: { id },
      data: {
        status: 'archived',
        is_active: false,
      },
    });
    return { message: 'Requisito archivado correctamente' };
  }

  // ── KPI AI Extraction ───────────────────────────────────────────────

  async extractKpisFromDocument(requirementId: string) {
    const requirement = await this.prisma.ministryRequirement.findUnique({
      where: { id: requirementId },
    });
    if (!requirement) throw new NotFoundException('Requirement not found');

    // Set status to processing
    await this.prisma.ministryRequirement.update({
      where: { id: requirementId },
      data: { status: 'processing' },
    });

    const prompt = `Extract KPIs from this ministry requirement document. Return a JSON array of KPI objects.
Each KPI must have: name, description, category, weight, target_value, minimum_pass_value, trigger_event.
Document text: ${requirement.raw_text || 'No text available'}`;

    const systemPrompt = 'You are a KPI extraction expert. Return ONLY a valid JSON array, no explanations.';

    const aiResult = await this.aiService.sendMessage(prompt, systemPrompt, [], undefined, true);

    if (aiResult.mode === 'scripted') {
      return { kpis: [], mode: 'scripted' as const, message: 'AI unavailable, manual extraction required' };
    }

    try {
      const jsonMatch = aiResult.response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { kpis: [], mode: 'scripted' as const, message: 'Could not parse AI response' };
      }

      const extractedKpis = JSON.parse(jsonMatch[0]);
      const savedKpis: any[] = [];

      for (const kpiData of extractedKpis) {
        const kpi = await this.prisma.kPI.create({
          data: {
            course_id: requirement.course_id,
            ministry_requirement_id: requirementId,
            name: kpiData.name,
            description: kpiData.description || '',
            category: kpiData.category || 'general',
            weight: kpiData.weight || 1.0,
            target_value: kpiData.target_value || 100,
            minimum_pass_value: kpiData.minimum_pass_value || 80,
            thresholds: { excellent: 95, good: 85, acceptable: 75, poor: 0 },
            prompt_instruction: kpiData.prompt_instruction || null,
            trigger_event: kpiData.trigger_event || 'generic',
            is_active: true,
          },
        });
        savedKpis.push(kpi);
      }

      await this.prisma.ministryRequirement.update({
        where: { id: requirementId },
        data: {
          kpis_generated: savedKpis.length,
          status: 'extracted',
        },
      });

      return { kpis: this.serialize(savedKpis), mode: 'live' as const };
    } catch {
      return { kpis: [], mode: 'scripted' as const, message: 'Failed to parse AI KPI extraction' };
    }
  }

  // ── KPIs ────────────────────────────────────────────────────────────

  async listKpis(params: {
    course_id?: string;
    ministry_requirement_id?: string;
    active?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, ...filters } = params;
    const where: any = {};
    if (filters.course_id) where.course_id = filters.course_id;
    if (filters.ministry_requirement_id) where.ministry_requirement_id = filters.ministry_requirement_id;
    if (filters.active !== undefined) where.is_active = filters.active === 'true';

    const result = await paginate(this.prisma.kPI, where, {
      page,
      limit,
      orderBy: { created_at: 'desc' },
    });

    return { ...result, data: this.serialize(result.data) };
  }

  async getKpi(id: string) {
    const kpi = await this.prisma.kPI.findUnique({ where: { id } });
    if (!kpi) return null;
    return this.serialize(kpi);
  }

  async createKpi(dto: CreateKpiDto) {
    const created = await this.prisma.kPI.create({
      data: {
        course_id: dto.course_id,
        ministry_requirement_id: dto.ministry_requirement_id,
        name: dto.name,
        description: dto.description || '',
        category: dto.category || 'general',
        weight: dto.weight || 1.0,
        target_value: dto.target_value || 100,
        minimum_pass_value: dto.minimum_pass_value || 80,
        thresholds: (dto.thresholds || { excellent: 95, good: 85, acceptable: 75, poor: 0 }) as any,
        prompt_instruction: dto.prompt_instruction,
        trigger_event: dto.trigger_event || 'generic',
        success_criteria: dto.success_criteria,
        is_active: true,
      } as any,
    });
    return this.serialize(created);
  }

  async updateKpi(id: string, data: Partial<CreateKpiDto> & { is_active?: boolean }) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category) updateData.category = data.category;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.target_value !== undefined) updateData.target_value = data.target_value;
    if (data.minimum_pass_value !== undefined) updateData.minimum_pass_value = data.minimum_pass_value;
    if (data.thresholds) updateData.thresholds = data.thresholds;
    if (data.prompt_instruction !== undefined) updateData.prompt_instruction = data.prompt_instruction;
    if (data.trigger_event) updateData.trigger_event = data.trigger_event;
    if (data.success_criteria !== undefined) updateData.success_criteria = data.success_criteria;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const updated = await this.prisma.kPI.update({
      where: { id },
      data: updateData,
    });
    return this.serialize(updated);
  }

  async deactivateKpi(id: string) {
    const updated = await this.prisma.kPI.update({
      where: { id },
      data: { is_active: false },
    });
    return this.serialize(updated);
  }

  async healthCheck() {
    return { status: 'ok', module: 'ministry', endpoints: ['requirements', 'kpis'] };
  }
}
