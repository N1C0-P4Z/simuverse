import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
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
      prisma.courseDocument.findMany.mockResolvedValue([]);
      prisma.courseDocument.count.mockResolvedValue(0);

      await service.findAll('course-1');

      expect(prisma.courseDocument.findMany).toHaveBeenCalledWith({
        where: { course_id: 'course-1' },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
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
