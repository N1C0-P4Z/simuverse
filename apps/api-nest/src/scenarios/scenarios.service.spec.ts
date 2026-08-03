import { NotFoundException } from '@nestjs/common';
import { ScenariosService } from './scenarios.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ScenariosService', () => {
  let service: ScenariosService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      scenario: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new ScenariosService(prisma as PrismaService);
  });

  describe('findAll with pagination', () => {
    it('returns paginated result with default page=1, limit=20', async () => {
      const scenarios = [{ id: 's1', title: 'Scenario 1' }];
      prisma.scenario.findMany.mockResolvedValue(scenarios);
      prisma.scenario.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result).toEqual({ data: scenarios, total: 1, page: 1, limit: 20 });
      expect(prisma.scenario.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });

    it('returns paginated result with custom page and limit', async () => {
      prisma.scenario.findMany.mockResolvedValue([]);
      prisma.scenario.count.mockResolvedValue(0);

      const result = await service.findAll(undefined, { page: 3, limit: 10 });

      expect(result).toEqual({ data: [], total: 0, page: 3, limit: 10 });
      expect(prisma.scenario.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        skip: 20,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('passes filters to where clause', async () => {
      prisma.scenario.findMany.mockResolvedValue([]);
      prisma.scenario.count.mockResolvedValue(0);

      await service.findAll({ course_id: 'c1', difficulty: 'hard' });

      expect(prisma.scenario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
            course_id: 'c1',
            difficulty: 'hard',
          }),
        }),
      );
    });
  });

  describe('findAllDropdown (unpaginated)', () => {
    it('returns active scenarios without pagination', async () => {
      const scenarios = [{ id: 's1', title: 'Scenario 1' }];
      prisma.scenario.findMany.mockResolvedValue(scenarios);

      const result = await service.findAllDropdown();

      expect(result).toEqual(scenarios);
      expect(prisma.scenario.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('throws NotFoundException for missing scenario', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting is_active false', async () => {
      prisma.scenario.update.mockResolvedValue({ id: 's1', is_active: false });
      await service.remove('s1');
      expect(prisma.scenario.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { is_active: false },
      });
    });

    it('maps P2025 to NotFoundException', async () => {
      prisma.scenario.update.mockRejectedValue({ code: 'P2025' });
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
