import { NotFoundException } from '@nestjs/common';
import { SponsorsService } from './sponsors.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SponsorsService', () => {
  let service: SponsorsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      sponsor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new SponsorsService(prisma as PrismaService);
  });

  it('findAll orders by name and returns paginated result', async () => {
    prisma.sponsor.findMany.mockResolvedValue([]);
    prisma.sponsor.count.mockResolvedValue(0);
    const result = await service.findAll();
    expect(prisma.sponsor.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 20,
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('findOne throws NotFoundException for a missing sponsor', async () => {
    prisma.sponsor.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('create passes the dto straight to prisma', async () => {
    const dto = { name: 'Acme', website: 'https://acme.com' };
    prisma.sponsor.create.mockResolvedValue({ id: 1, ...dto, is_active: true });
    await service.create(dto);
    expect(prisma.sponsor.create).toHaveBeenCalledWith({ data: dto });
  });

  it('remove soft-deletes by setting is_active false', async () => {
    prisma.sponsor.update.mockResolvedValue({ id: 1, is_active: false });
    await service.remove(1);
    expect(prisma.sponsor.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { is_active: false } });
  });

  it('remove maps a P2025 prisma error to NotFoundException', async () => {
    prisma.sponsor.update.mockRejectedValue({ code: 'P2025' });
    await expect(service.remove(999)).rejects.toThrow(NotFoundException);
  });

  it('reactivate sets is_active true', async () => {
    prisma.sponsor.update.mockResolvedValue({ id: 1, is_active: true });
    await service.reactivate(1);
    expect(prisma.sponsor.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { is_active: true } });
  });

  describe('findAll with pagination', () => {
    it('returns paginated result with default page=1, limit=20', async () => {
      const sponsors = [{ id: 1, name: 'Acme' }, { id: 2, name: 'Beta' }];
      prisma.sponsor.findMany.mockResolvedValue(sponsors);
      prisma.sponsor.count.mockResolvedValue(2);

      const result = await service.findAll();

      expect(result).toEqual({ data: sponsors, total: 2, page: 1, limit: 20 });
      expect(prisma.sponsor.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
      expect(prisma.sponsor.count).toHaveBeenCalledWith({ where: {} });
    });

    it('returns paginated result with custom page and limit', async () => {
      const sponsors = [{ id: 3, name: 'Gamma' }];
      prisma.sponsor.findMany.mockResolvedValue(sponsors);
      prisma.sponsor.count.mockResolvedValue(10);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(result).toEqual({ data: sponsors, total: 10, page: 2, limit: 5 });
      expect(prisma.sponsor.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 5,
        take: 5,
        orderBy: { name: 'asc' },
      });
    });
  });
});
