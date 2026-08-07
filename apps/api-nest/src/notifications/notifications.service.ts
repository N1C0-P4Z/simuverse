import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CreateNotificationDto, UpdateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    const created = await this.prisma.notification.create({
      data: {
        recipient_id: dto.recipient_id,
        actor_id: dto.actor_id || null,
        simulation_instance_id: dto.simulation_instance_id || null,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        metadata: dto.metadata || undefined,
        is_read: false,
        is_sent: false,
      },
    });
    return created;
  }

  async findAll(params: {
    recipient_id?: string;
    unread?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, ...filters } = params;
    const where: any = {};
    if (filters.recipient_id) where.recipient_id = filters.recipient_id;
    if (filters.unread === 'true') where.is_read = false;

    return paginate(this.prisma.notification, where, {
      page,
      limit,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async update(id: string, dto: UpdateNotificationDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.metadata !== undefined) data.metadata = dto.metadata;
    if (dto.is_read !== undefined) {
      data.is_read = dto.is_read;
      if (dto.is_read) data.read_at = new Date();
    }

    return this.prisma.notification.update({ where: { id }, data });
  }

  async markAsRead(id: string) {
    await this.findOne(id);
    return this.prisma.notification.update({
      where: { id },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted successfully' };
  }
}
