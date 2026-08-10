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

  private async resolveCourseIdVariants(courseId: string): Promise<string[]> {
    const course = await this.prisma.course.findFirst({
      where: { OR: [{ id: courseId }, { course_id: courseId }] },
      select: { id: true, course_id: true },
    });
    if (!course) return [courseId];
    return [...new Set([course.id, course.course_id])];
  }

  private async findCourseIdsForCategory(category: string, courseId?: string): Promise<string[]> {
    const categoryRow = await this.prisma.category.findFirst({
      where: {
        OR: [
          { code: { equals: category, mode: 'insensitive' } },
          { name: { equals: category, mode: 'insensitive' } },
        ],
      },
      select: { code: true, name: true },
    });

    const tokens = new Set<string>([category.toLowerCase()]);
    if (categoryRow) {
      tokens.add(categoryRow.code.toLowerCase());
      tokens.add(categoryRow.name.toLowerCase());
    }

    const courses = await this.prisma.course.findMany({
      where: courseId
        ? { OR: [{ id: courseId }, { course_id: courseId }] }
        : {},
      select: { id: true, course_id: true, category: true, categories: true },
    });

    const matchingIds = new Set<string>();
    for (const c of courses) {
      const tags = [
        c.category,
        ...(Array.isArray(c.categories) ? (c.categories as string[]) : []),
      ]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase());

      if (tags.some((tag) => tokens.has(tag))) {
        matchingIds.add(c.id);
        matchingIds.add(c.course_id);
      }
    }

    return [...matchingIds];
  }

  async findAll(
    courseId?: string,
    opts?: { category?: string; page?: number; limit?: number },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, category } = opts || {};
    let where: Record<string, unknown> = {};

    if (category?.trim()) {
      const matchingCourseIds = await this.findCourseIdsForCategory(category.trim(), courseId);
      if (matchingCourseIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      where = { course_id: { in: matchingCourseIds } };
    } else if (courseId) {
      const ids = await this.resolveCourseIdVariants(courseId);
      where = { course_id: { in: ids } };
    }

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
