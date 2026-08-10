import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RbacService } from '../rbac/rbac.service';

describe('NotificationsController — RBAC Phase A', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: {} },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(NotificationsController);
  });

  describe('class-level @Roles', () => {
    it('has role admin only', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, NotificationsController);
      expect(roles).toEqual(['admin']);
    });
  });

  describe('guard metadata', () => {
    it('has UseGuards with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', NotificationsController) || [];
      const guardNames = guards.map((g: any) => g.name || g);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
    });
  });
});

describe('NotificationsController — Pagination', () => {
  let controller: NotificationsController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockService },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(NotificationsController);
  });

  it('passes pagination and filters to service.findAll', async () => {
    const expected = { data: [{ id: '1' }], total: 1, page: 1, limit: 10 };
    mockService.findAll.mockResolvedValue(expected);

    const result = await controller.findAll('user-1', 'true', { page: 1, limit: 10 });

    expect(mockService.findAll).toHaveBeenCalledWith({
      recipient_id: 'user-1',
      unread: 'true',
      page: 1,
      limit: 10,
    });
    expect(result).toEqual(expected);
  });
});
