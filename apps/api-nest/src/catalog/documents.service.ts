import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  private assertValidUrl(url: string): void {
    const trimmed = url.trim();
    if (/^\/api\/files\/[^/]+\/download\/?$/.test(trimmed)) {
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new BadRequestException('file_url must use http or https');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('file_url must be a valid URL');
    }
  }

  async findAll(courseId?: string, opts?: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = opts || {};
    const where = courseId ? { course_id: courseId } : {};
    return paginate(this.prisma.courseDocument, where, { page, limit, orderBy: { created_at: 'desc' } });
  }

  async findAllDropdown(courseId?: string) {
    const where = courseId ? { course_id: courseId } : {};
    return this.prisma.courseDocument.findMany({ where, orderBy: { created_at: 'desc' } });
  }

  async findOne(id: number) {
    const doc = await this.prisma.courseDocument.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }

  async create(dto: CreateDocumentDto) {
    const fileUrl = dto.file_url.trim();
    this.assertValidUrl(fileUrl);
    return this.prisma.courseDocument.create({
      data: {
        course_id: dto.course_id,
        document_name: dto.document_name,
        document_type: dto.document_type || 'other',
        file_url: fileUrl,
        uploaded_by: dto.uploaded_by,
      },
    });
  }

  async update(id: number, dto: UpdateDocumentDto) {
    await this.findOne(id);
    const data = { ...dto };
    if (data.file_url) {
      data.file_url = data.file_url.trim();
      this.assertValidUrl(data.file_url);
    }
    return this.prisma.courseDocument.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.courseDocument.update({ where: { id }, data: { is_active: false } });
    return { message: 'Document deactivated' };
  }

  async reactivate(id: number) {
    await this.findOne(id);
    await this.prisma.courseDocument.update({ where: { id }, data: { is_active: true } });
    return { message: 'Document reactivated' };
  }
}
