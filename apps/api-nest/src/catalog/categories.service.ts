import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(opts?: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = opts || {};
    return paginate(this.prisma.category, {}, { page, limit, orderBy: { name: 'asc' } });
  }

  async findAllDropdown() {
    return this.prisma.category.findMany({ where: {}, orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: dto.name }, { code: dto.code.toUpperCase() }] },
    });
    if (existing) {
      throw new ConflictException('Category with that name or code already exists');
    }

    return this.prisma.category.create({
      data: { name: dto.name, code: dto.code.toUpperCase(), description: dto.description },
    });
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.category.findFirst({
        where: { code: dto.code.toUpperCase(), NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Category with that code already exists');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.category.update({ where: { id }, data: { is_active: false } });
    return { message: 'Category deactivated' };
  }

  async reactivate(id: number) {
    await this.findOne(id);
    await this.prisma.category.update({ where: { id }, data: { is_active: true } });
    return { message: 'Category reactivated' };
  }
}
