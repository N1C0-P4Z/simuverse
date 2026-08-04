import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new UsersService(prisma as PrismaService);
  });

  describe('findAll with pagination', () => {
    it('returns paginated result with default page=1, limit=20', async () => {
      const users = [{ id: 'u1', name: 'Alice' }];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result).toEqual({ data: users, total: 1, page: 1, limit: 20 });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
    });

    it('applies role filter when provided', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ role: 'teacher' });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'teacher' },
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
    });

    it('applies search filter across name and email', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ search: 'alice' });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'alice', mode: 'insensitive' } },
            { email: { contains: 'alice', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
    });

    it('applies both role and search filters', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ role: 'student', search: 'test', page: 2, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'student',
          OR: [
            { name: { contains: 'test', mode: 'insensitive' } },
            { email: { contains: 'test', mode: 'insensitive' } },
          ],
        },
        skip: 10,
        take: 10,
        orderBy: { name: 'asc' },
      });
    });

    it('respects custom page and limit', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(50);

      const result = await service.findAll({ page: 3, limit: 15 });

      expect(result).toEqual({ data: [], total: 50, page: 3, limit: 15 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 30, take: 15 }),
      );
    });
  });
});
