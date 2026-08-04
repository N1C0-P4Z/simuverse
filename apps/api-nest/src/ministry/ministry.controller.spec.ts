import { Test, TestingModule } from '@nestjs/testing';
import { MinistryController } from './ministry.controller';
import { MinistryService } from './ministry.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RbacService } from '../rbac/rbac.service';

describe('MinistryController — RBAC Phase A', () => {
  let controller: MinistryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MinistryController],
      providers: [
        { provide: MinistryService, useValue: {} },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(MinistryController);
  });

  describe('class-level @Roles', () => {
    it('has roles admin and ministerio', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, MinistryController);
      expect(roles).toEqual(['admin', 'ministerio']);
    });
  });

  describe('guard metadata', () => {
    it('has UseGuards with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', MinistryController) || [];
      const guardNames = guards.map((g: any) => g.name || g);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
    });
  });
});

describe('MinistryController — Pagination', () => {
  let controller: MinistryController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockService = {
      listRequirements: jest.fn(),
      listKpis: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MinistryController],
      providers: [
        { provide: MinistryService, useValue: mockService },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(MinistryController);
  });

  it('passes pagination to listRequirements', async () => {
    const expected = { data: [{ id: 'r1' }], total: 1, page: 1, limit: 10 };
    mockService.listRequirements.mockResolvedValue(expected);

    const result = await controller.listRequirements('course-1', 'active', { page: 1, limit: 10 });

    expect(mockService.listRequirements).toHaveBeenCalledWith({
      course_id: 'course-1',
      status: 'active',
      page: 1,
      limit: 10,
    });
    expect(result).toEqual(expected);
  });

  it('passes pagination to listKpis', async () => {
    const expected = { data: [{ id: 'k1' }], total: 1, page: 2, limit: 5 };
    mockService.listKpis.mockResolvedValue(expected);

    const result = await controller.listKpis('course-1', 'req-1', 'true', { page: 2, limit: 5 });

    expect(mockService.listKpis).toHaveBeenCalledWith({
      course_id: 'course-1',
      ministry_requirement_id: 'req-1',
      active: 'true',
      page: 2,
      limit: 5,
    });
    expect(result).toEqual(expected);
  });
});
