import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RbacService } from '../rbac/rbac.service';

describe('AssignmentsController — RBAC Phase A', () => {
  let controller: AssignmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        { provide: AssignmentsService, useValue: {} },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(AssignmentsController);
  });

  describe('class-level @Roles', () => {
    it('has roles admin and teacher', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AssignmentsController);
      expect(roles).toEqual(['admin', 'teacher']);
    });
  });

  describe('guard metadata', () => {
    it('has UseGuards with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', AssignmentsController) || [];
      const guardNames = guards.map((g: any) => g.name || g);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
    });
  });
});

describe('AssignmentsController — Pagination', () => {
  let controller: AssignmentsController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        { provide: AssignmentsService, useValue: mockService },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(AssignmentsController);
  });

  it('passes pagination params to service.findAll', async () => {
    const expected = { data: [], total: 0, page: 2, limit: 10 };
    mockService.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(undefined, undefined, undefined, { page: 2, limit: 10 });

    expect(mockService.findAll).toHaveBeenCalledWith({
      student_id: undefined,
      course_id: undefined,
      status: undefined,
      page: 2,
      limit: 10,
    });
    expect(result).toEqual(expected);
  });

  it('preserves existing filters along with pagination', async () => {
    const expected = { data: [{ id: 1 }], total: 1, page: 1, limit: 20 };
    mockService.findAll.mockResolvedValue(expected);

    const result = await controller.findAll('student-1', 'course-1', 'pending', { page: 1, limit: 20 });

    expect(mockService.findAll).toHaveBeenCalledWith({
      student_id: 'student-1',
      course_id: 'course-1',
      status: 'pending',
      page: 1,
      limit: 20,
    });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
