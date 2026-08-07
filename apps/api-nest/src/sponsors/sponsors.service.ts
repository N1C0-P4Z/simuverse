import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';

@Injectable()
export class SponsorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(opts?: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = opts || {};
    return paginate(this.prisma.sponsor, {}, { page, limit, orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const sponsor = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) throw new NotFoundException('Sponsor not found');
    return sponsor;
  }

  async create(dto: CreateSponsorDto) {
    return this.prisma.sponsor.create({ data: dto });
  }

  async update(id: number, dto: UpdateSponsorDto) {
    try {
      return await this.prisma.sponsor.update({ where: { id }, data: dto });
    } catch (error: any) {
      if (error.code === 'P2025') throw new NotFoundException('Sponsor not found');
      throw error;
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.sponsor.update({ where: { id }, data: { is_active: false } });
    } catch (error: any) {
      if (error.code === 'P2025') throw new NotFoundException('Sponsor not found');
      throw error;
    }
  }

  async reactivate(id: number) {
    try {
      return await this.prisma.sponsor.update({ where: { id }, data: { is_active: true } });
    } catch (error: any) {
      if (error.code === 'P2025') throw new NotFoundException('Sponsor not found');
      throw error;
    }
  }
}
