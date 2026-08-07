import { NotFoundException, ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new CategoriesService(prisma as PrismaService);
  });

  describe('findAll with pagination', () => {
    it('returns paginated result with default page=1, limit=20', async () => {
      const categories = [
        { id: 1, name: 'RRHH', code: 'RRHH' },
        { id: 2, name: 'Ventas', code: 'VENTAS' },
      ];
      prisma.category.findMany.mockResolvedValue(categories);
      prisma.category.count.mockResolvedValue(2);

      const result = await service.findAll();

      expect(result).toEqual({ data: categories, total: 2, page: 1, limit: 20 });
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
      expect(prisma.category.count).toHaveBeenCalledWith({ where: {} });
    });

    it('returns paginated result with custom page and limit', async () => {
      const categories = [{ id: 3, name: 'Legal', code: 'LEGAL' }];
      prisma.category.findMany.mockResolvedValue(categories);
      prisma.category.count.mockResolvedValue(10);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(result).toEqual({ data: categories, total: 10, page: 2, limit: 5 });
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 5,
        take: 5,
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findAllDropdown (unpaginated)', () => {
    it('returns all categories without pagination for dropdown use', async () => {
      const categories = [
        { id: 1, name: 'RRHH', code: 'RRHH' },
        { id: 2, name: 'Ventas', code: 'VENTAS' },
      ];
      prisma.category.findMany.mockResolvedValue(categories);

      const result = await service.findAllDropdown();

      expect(result).toEqual(categories);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a missing category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('returns the category when found', async () => {
      const category = { id: 1, name: 'RRHH', code: 'RRHH' };
      prisma.category.findUnique.mockResolvedValue(category);
      const result = await service.findOne(1);
      expect(result).toEqual(category);
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting is_active false', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 1 });
      prisma.category.update.mockResolvedValue({ id: 1, is_active: false });
      await service.remove(1);
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { is_active: false },
      });
    });
  });

  describe('reactivate', () => {
    it('sets is_active true', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 1 });
      prisma.category.update.mockResolvedValue({ id: 1, is_active: true });
      await service.reactivate(1);
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { is_active: true },
      });
    });
  });
});
