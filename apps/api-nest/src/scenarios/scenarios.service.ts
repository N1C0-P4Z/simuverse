import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';

@Injectable()
export class ScenariosService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { course_id?: string; difficulty?: string; scenario_type?: string; active?: boolean; includeInactive?: boolean }, opts?: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = opts || {};
    const where: any = {};
    if (filters?.includeInactive) {
      // No is_active filter — show all
    } else if (filters?.active !== undefined) {
      where.is_active = filters.active;
    } else {
      where.is_active = true;
    }

    if (filters?.course_id) {
      where.course_id = filters.course_id;
    }
    if (filters?.difficulty) {
      where.difficulty = filters.difficulty;
    }
    if (filters?.scenario_type) {
      where.scenario_type = filters.scenario_type;
    }

    return paginate(this.prisma.scenario, where, { page, limit, orderBy: { created_at: 'desc' } });
  }

  async findAllDropdown() {
    return this.prisma.scenario.findMany({ where: { is_active: true }, orderBy: { created_at: 'desc' } });
  }

  async findById(id: string) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      throw new NotFoundException('Scenario not found');
    }
    return scenario;
  }

  async create(data: {
    course_id: string;
    title: string;
    description?: string;
    scenario_type?: string;
    difficulty?: string;
    content?: any;
    expected_outcomes?: any;
    categories?: any;
    config?: any;
    is_active?: boolean;
  }) {
    return this.prisma.scenario.create({
      data: {
        course_id: data.course_id,
        title: data.title,
        description: data.description,
        scenario_type: data.scenario_type,
        difficulty: (data.difficulty as any) || 'medium',
        content: data.content || undefined,
        expected_outcomes: data.expected_outcomes || undefined,
        categories: data.categories || undefined,
        config: data.config || undefined,
        is_active: data.is_active ?? true,
      },
    });
  }

  async update(id: string, data: {
    title?: string;
    description?: string;
    scenario_type?: string;
    difficulty?: string;
    content?: any;
    expected_outcomes?: any;
    categories?: any;
    config?: any;
    is_active?: boolean;
  }) {
    try {
      return await this.prisma.scenario.update({
        where: { id },
        data: {
          ...data,
          difficulty: data.difficulty as any || undefined,
          content: data.content || undefined,
          expected_outcomes: data.expected_outcomes || undefined,
          categories: data.categories || undefined,
          config: data.config || undefined,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Scenario not found');
      }
      throw error;
    }
  }

  async remove(id: string) {
    // Soft delete — set is_active to false
    try {
      return await this.prisma.scenario.update({
        where: { id },
        data: { is_active: false },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Scenario not found');
      }
      throw error;
    }
  }

  async clone(id: string) {
    const original = await this.findById(id);

    const clonedData = {
      course_id: original.course_id,
      title: `${original.title} (Copy)`,
      description: original.description,
      scenario_type: original.scenario_type,
      difficulty: original.difficulty,
      content: original.content,
      expected_outcomes: original.expected_outcomes,
      categories: original.categories,
      config: original.config,
      is_active: true,
    };

    return this.create(clonedData as any);
  }
}
