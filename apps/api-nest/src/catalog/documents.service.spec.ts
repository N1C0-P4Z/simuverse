import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      category: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      course: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      courseDocument: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new DocumentsService(prisma as PrismaService);
  });

  describe('findAll with pagination', () => {
    it('returns paginated result with default page=1, limit=20', async () => {
      const docs = [{ id: 1, document_name: 'Doc 1' }];
      prisma.courseDocument.findMany.mockResolvedValue(docs);
      prisma.courseDocument.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result).toEqual({ data: docs, total: 1, page: 1, limit: 20 });
      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });

    it('returns paginated result with custom page and limit', async () => {
      const docs = [{ id: 3, document_name: 'Doc 3' }];
      prisma.courseDocument.findMany.mockResolvedValue(docs);
      prisma.courseDocument.count.mockResolvedValue(10);

      const result = await service.findAll(undefined, { page: 2, limit: 5 });

      expect(result).toEqual({ data: docs, total: 10, page: 2, limit: 5 });
      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 5,
        take: 5,
        orderBy: { created_at: 'desc' },
      });
    });

    it('filters by courseId when provided', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'uuid-1', course_id: 'legacy-1' });
      prisma.courseDocument.findMany.mockResolvedValue([]);
      prisma.courseDocument.count.mockResolvedValue(0);

      await service.findAll('legacy-1');

      expect(prisma.course.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: 'legacy-1' }, { course_id: 'legacy-1' }] },
        select: { id: true, course_id: true },
      });
      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: { course_id: { in: ['uuid-1', 'legacy-1'] } },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });

    it('filters by courseId alone when course row not found', async () => {
      prisma.course.findFirst.mockResolvedValue(null);
      prisma.courseDocument.findMany.mockResolvedValue([]);
      prisma.courseDocument.count.mockResolvedValue(0);

      await service.findAll('unknown-id');

      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: { course_id: { in: ['unknown-id'] } },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });

    it('filters by category only via matching course ids', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'course-a', course_id: 'legacy-a', category: 'ADM', categories: null },
        { id: 'course-b', course_id: 'legacy-b', category: 'rrhh', categories: ['ADM'] },
        { id: 'course-c', course_id: 'legacy-c', category: 'it', categories: null },
      ]);
      prisma.courseDocument.findMany.mockResolvedValue([]);
      prisma.courseDocument.count.mockResolvedValue(0);

      await service.findAll(undefined, { category: 'adm' });

      expect(prisma.course.findMany).toHaveBeenCalled();
      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: {
          course_id: {
            in: expect.arrayContaining(['course-a', 'legacy-a', 'course-b', 'legacy-b']),
          },
        },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
      const call = prisma.courseDocument.findMany.mock.calls[0][0];
      expect(call.where.course_id.in).toHaveLength(4);
    });

    it('matches category code ADM against course category name administracion via Category row', async () => {
      prisma.category.findFirst.mockResolvedValue({ code: 'ADM', name: 'administracion' });
      prisma.course.findMany.mockResolvedValue([
        { id: 'uuid-1', course_id: 'legacy-1', category: 'administracion', categories: null },
        { id: 'uuid-2', course_id: 'legacy-2', category: 'it', categories: null },
      ]);
      prisma.courseDocument.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.courseDocument.count.mockResolvedValue(1);

      await service.findAll(undefined, { category: 'ADM' });

      expect(prisma.category.findFirst).toHaveBeenCalled();
      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: { course_id: { in: expect.arrayContaining(['uuid-1', 'legacy-1']) } },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
      const call = prisma.courseDocument.findMany.mock.calls[0][0];
      expect(call.where.course_id.in).toHaveLength(2);
    });

    it('filters by both courseId and category', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'course-1', course_id: 'legacy-1', category: 'ADM', categories: null },
      ]);
      prisma.courseDocument.findMany.mockResolvedValue([]);
      prisma.courseDocument.count.mockResolvedValue(0);

      await service.findAll('course-1', { category: 'ADM' });

      expect(prisma.course.findMany).toHaveBeenCalledWith({
        where: { OR: [{ id: 'course-1' }, { course_id: 'course-1' }] },
        select: { id: true, course_id: true, category: true, categories: true },
      });
      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: { course_id: { in: expect.arrayContaining(['course-1', 'legacy-1']) } },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });

    it('returns empty paginated result when category matches no courses', async () => {
      prisma.category.findFirst.mockResolvedValue({ code: 'ADM', name: 'administracion' });
      prisma.course.findMany.mockResolvedValue([
        { id: 'course-1', course_id: 'legacy-1', category: 'it', categories: null },
      ]);

      const result = await service.findAll(undefined, { category: 'ADM' });

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
      expect(prisma.courseDocument.findMany).not.toHaveBeenCalled();
    });

    it('returns empty paginated result when courseId does not match category', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'course-1', course_id: 'legacy-1', category: 'it', categories: null },
      ]);

      const result = await service.findAll('course-1', { category: 'ADM' });

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
      expect(prisma.courseDocument.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findAllDropdown (unpaginated)', () => {
    it('returns all documents without pagination', async () => {
      const docs = [{ id: 1, document_name: 'Doc 1' }];
      prisma.courseDocument.findMany.mockResolvedValue(docs);

      const result = await service.findAllDropdown();

      expect(result).toEqual(docs);
      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for missing document', async () => {
      prisma.courseDocument.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting is_active false', async () => {
      prisma.courseDocument.findUnique.mockResolvedValue({ id: 1 });
      prisma.courseDocument.update.mockResolvedValue({ id: 1, is_active: false });
      await service.remove(1);
      expect(prisma.courseDocument.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { is_active: false },
      });
    });
  });
});
