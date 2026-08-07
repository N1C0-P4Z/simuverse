import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RbacService } from '../rbac/rbac.service';

describe('AssessmentsController — RBAC Phase A (method-level)', () => {
  let controller: AssessmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentsController],
      providers: [
        { provide: AssessmentsService, useValue: {} },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(AssessmentsController);
  });

  describe('POST method @Roles', () => {
    it('has roles admin and teacher on create', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.create);
      expect(roles).toEqual(['admin', 'teacher']);
    });
  });
});

describe('AssessmentsController — Pagination', () => {
  let controller: AssessmentsController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentsController],
      providers: [
        { provide: AssessmentsService, useValue: mockService },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(AssessmentsController);
  });

  it('passes pagination and filters to service.findAll', async () => {
    const expected = { data: [{ id: 'a1' }], total: 1, page: 1, limit: 10 };
    mockService.findAll.mockResolvedValue(expected);

    const result = await controller.findAll('course-1', 'user-1', { role: 'admin' }, { page: 1, limit: 10 });

    expect(mockService.findAll).toHaveBeenCalledWith({
      course_id: 'course-1',
      user_id: 'user-1',
      page: 1,
      limit: 10,
    });
    expect(result).toEqual(expected);
  });

  it('forces student user_id from authenticated user', async () => {
    const expected = { data: [], total: 0, page: 1, limit: 20 };
    mockService.findAll.mockResolvedValue(expected);

    await controller.findAll(undefined, undefined, { id: 'student-1', role: 'student' }, { page: 1, limit: 20 });

    expect(mockService.findAll).toHaveBeenCalledWith({
      course_id: undefined,
      user_id: 'student-1',
      page: 1,
      limit: 20,
    });
  });
});
