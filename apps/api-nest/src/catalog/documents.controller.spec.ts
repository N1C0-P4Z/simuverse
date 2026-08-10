import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RbacService } from '../rbac/rbac.service';

describe('DocumentsController — RBAC Phase A', () => {
  let controller: DocumentsController;
  let documentsService: { findAll: jest.Mock };

  beforeEach(async () => {
    documentsService = { findAll: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: documentsService },
        { provide: RbacService, useValue: {} },
      ],
    }).compile();

    controller = module.get(DocumentsController);
  });

  describe('class-level @Roles', () => {
    it('has roles admin and teacher', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, DocumentsController);
      expect(roles).toEqual(['admin', 'teacher']);
    });
  });

  describe('findAll', () => {
    it('forwards course_id, category, page and limit to service', async () => {
      documentsService.findAll.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });

      await controller.findAll({
        course_id: 'course-1',
        category: 'ADM',
        page: 2,
        limit: 10,
      });

      expect(documentsService.findAll).toHaveBeenCalledWith('course-1', {
        category: 'ADM',
        page: 2,
        limit: 10,
      });
    });
  });

  describe('guard metadata', () => {
    it('has UseGuards with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', DocumentsController) || [];
      const guardNames = guards.map((g: any) => g.name || g);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
    });
  });
});
