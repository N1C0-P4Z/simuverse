import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CreateFlowTemplateDto } from './dto/create-flow-template.dto';
import { UpdateFlowTemplateDto } from './dto/update-flow-template.dto';

@Injectable()
export class FlowTemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { family?: string; course_id?: string; active?: string; includeInactive?: string }, opts?: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = opts || {};
    const where: any = {};
    if (filters?.family) where.family = filters.family;
    if (filters?.course_id) where.course_id = filters.course_id;
    if (filters?.includeInactive === 'true') {
      // No is_active filter — show all
    } else if (filters?.active !== undefined) {
      where.is_active = filters.active !== 'false';
    } else {
      where.is_active = true;
    }

    const result = await paginate(this.prisma.flowTemplate, where, {
      page,
      limit,
      orderBy: { family: 'asc' },
    });

    // Parse template_data from JSON string to object
    return {
      ...result,
      data: result.data.map((t: any) => {
        try {
          return { ...t, template_data: JSON.parse(t.template_data as string) };
        } catch {
          return t;
        }
      }),
    };
  }

  async findAllDropdown() {
    const templates = await this.prisma.flowTemplate.findMany({
      where: { is_active: true },
      orderBy: { family: 'asc' },
    });
    return templates.map((t) => {
      try {
        return { ...t, template_data: JSON.parse(t.template_data as string) };
      } catch {
        return t;
      }
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.flowTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    try {
      return { ...template, template_data: JSON.parse(template.template_data as string) };
    } catch {
      return template;
    }
  }

  async create(dto: CreateFlowTemplateDto) {
    const existing = await this.prisma.flowTemplate.findUnique({
      where: { id: dto.id },
    });
    if (existing) {
      throw new ConflictException('Template with that id already exists');
    }

    const dataStr =
      typeof dto.template_data === 'string'
        ? dto.template_data
        : JSON.stringify(dto.template_data);

    return this.prisma.flowTemplate.create({
      data: {
        id: dto.id,
        course_id: dto.course_id,
        course_code: dto.course_code || dto.id,
        title: dto.title,
        family: dto.family || 'administracion',
        description: dto.description,
        version: dto.version || '1.0',
        template_data: dataStr,
        is_active: true,
        created_by: dto.created_by,
      },
    });
  }

  async update(id: string, dto: UpdateFlowTemplateDto) {
    await this.findOne(id);

    const updateData: any = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.family) updateData.family = dto.family;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.version) updateData.version = dto.version;
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
    if (dto.template_data !== undefined) {
      updateData.template_data =
        typeof dto.template_data === 'string'
          ? dto.template_data
          : JSON.stringify(dto.template_data);
    }

    return this.prisma.flowTemplate.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.flowTemplate.update({
      where: { id },
      data: { is_active: false },
    });
    return { message: 'Template deactivated successfully' };
  }

  async duplicate(id: string, newId?: string) {
    const original = await this.findOne(id);
    const duplicateId = newId || `${original.id}-copia-${Date.now()}`;

    return this.prisma.flowTemplate.create({
      data: {
        id: duplicateId,
        course_id: original.course_id,
        course_code: `${original.course_code}-COPIA`,
        title: `${original.title} (Copia)`,
        family: original.family,
        description: original.description,
        version: original.version,
        template_data: JSON.stringify(original.template_data),
        is_active: true,
        created_by: original.created_by,
      },
    });
  }

  async bulkImport(templates: CreateFlowTemplateDto[]) {
    const results = { created: 0, updated: 0, errors: [] as string[] };

    for (const t of templates) {
      try {
        const dataStr =
          typeof t.template_data === 'string'
            ? t.template_data
            : JSON.stringify(t.template_data);

        const existing = await this.prisma.flowTemplate.findUnique({
          where: { id: t.id },
        });

        if (existing) {
          await this.prisma.flowTemplate.update({
            where: { id: t.id },
            data: {
              title: t.title || existing.title,
              family: t.family || existing.family,
              version: t.version || existing.version,
              template_data: dataStr,
            },
          });
          results.updated++;
        } else {
          await this.prisma.flowTemplate.create({
            data: {
              id: t.id,
              course_id: t.course_id,
              course_code: t.course_code || t.id,
              title: t.title,
              family: t.family || 'administracion',
              description: t.description,
              version: t.version || '1.0',
              template_data: dataStr,
              is_active: true,
              created_by: t.created_by,
            },
          });
          results.created++;
        }
      } catch (e: any) {
        results.errors.push(`${t.id}: ${e.message}`);
      }
    }

    return results;
  }
}
