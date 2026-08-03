import { ConflictException, NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CoursesService — association sync', () => {
  let service: CoursesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      course: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      courseEndorser: { deleteMany: jest.fn(), createMany: jest.fn() },
      courseSimulatedCompany: { deleteMany: jest.fn(), createMany: jest.fn() },
      courseFoundationConfig: { deleteMany: jest.fn(), createMany: jest.fn() },
      courseSponsor: { deleteMany: jest.fn(), createMany: jest.fn() },
      simulationInstance: { findMany: jest.fn().mockResolvedValue([]) },
      simulation: { findMany: jest.fn().mockResolvedValue([]) },
      simulationChatLog: { deleteMany: jest.fn() },
      simulationEvaluation: { deleteMany: jest.fn() },
      simulationAssignment: { deleteMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      enrollmentAttempt: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      courseDocument: { deleteMany: jest.fn() },
      flowTemplate: { deleteMany: jest.fn() },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };
    service = new CoursesService(prisma as PrismaService);
  });

  describe('create()', () => {
    const createdCourse = { id: 'course-1', course_id: 'C1', title: 'Course 1' };

    beforeEach(() => {
      prisma.course.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === 'course-1' ? createdCourse : null),
      );
      prisma.course.create.mockResolvedValue(createdCourse);
    });

    it('creates junction rows for every provided *_ids array', async () => {
      await service.create({
        course_id: 'C1',
        title: 'Course 1',
        category: 'it',
        endorser_ids: [1, 2],
        company_ids: [10],
        foundation_ids: [],
        sponsor_ids: [5],
      });

      expect(prisma.courseEndorser.createMany).toHaveBeenCalledWith({
        data: [
          { course_id: 'course-1', endorser_id: 1 },
          { course_id: 'course-1', endorser_id: 2 },
        ],
      });
      expect(prisma.courseSimulatedCompany.createMany).toHaveBeenCalledWith({
        data: [{ course_id: 'course-1', simulated_company_id: 10 }],
      });
      expect(prisma.courseFoundationConfig.createMany).not.toHaveBeenCalled();
      expect(prisma.courseSponsor.createMany).toHaveBeenCalledWith({
        data: [{ course_id: 'course-1', sponsor_id: 5 }],
      });
    });

    it('touches nothing when no association ids are provided', async () => {
      await service.create({ course_id: 'C1', title: 'Course 1', category: 'it' });

      expect(prisma.courseEndorser.deleteMany).not.toHaveBeenCalled();
      expect(prisma.courseEndorser.createMany).not.toHaveBeenCalled();
    });

    it('rolls back association writes when course creation fails inside the transaction', async () => {
      prisma.course.create.mockRejectedValue(new Error('db error'));

      await expect(
        service.create({ course_id: 'C1', title: 'Course 1', category: 'it', endorser_ids: [1] }),
      ).rejects.toThrow('db error');

      expect(prisma.courseEndorser.createMany).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    const updatedCourse = { id: 'course-1', course_id: 'C1', title: 'Updated' };

    beforeEach(() => {
      prisma.course.update.mockResolvedValue(updatedCourse);
      prisma.course.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === 'course-1' || where.course_id === 'course-1' ? updatedCourse : null),
      );
    });

    it('syncs an association: deletes existing links then recreates from the new array', async () => {
      await service.update('course-1', { endorser_ids: [3, 4] });

      expect(prisma.courseEndorser.deleteMany).toHaveBeenCalledWith({ where: { course_id: 'course-1' } });
      expect(prisma.courseEndorser.createMany).toHaveBeenCalledWith({
        data: [
          { course_id: 'course-1', endorser_id: 3 },
          { course_id: 'course-1', endorser_id: 4 },
        ],
      });
    });

    it('clears an association when given an empty array', async () => {
      await service.update('course-1', { sponsor_ids: [] });

      expect(prisma.courseSponsor.deleteMany).toHaveBeenCalledWith({ where: { course_id: 'course-1' } });
      expect(prisma.courseSponsor.createMany).not.toHaveBeenCalled();
    });

    it('leaves an association untouched when its key is omitted from the payload', async () => {
      await service.update('course-1', { title: 'Updated' });

      expect(prisma.courseEndorser.deleteMany).not.toHaveBeenCalled();
      expect(prisma.courseSimulatedCompany.deleteMany).not.toHaveBeenCalled();
      expect(prisma.courseFoundationConfig.deleteMany).not.toHaveBeenCalled();
      expect(prisma.courseSponsor.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('permanentDelete()', () => {
    it('throws NotFoundException for a missing course', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.permanentDelete('nope')).rejects.toThrow(NotFoundException);
      expect(prisma.course.delete).not.toHaveBeenCalled();
    });

    it('cleans FK-less tables then deletes the course', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.simulationInstance.findMany.mockResolvedValue([{ id: 'inst-1' }]);
      prisma.simulation.findMany.mockResolvedValue([{ id: 'sim-1' }]);
      prisma.course.delete.mockResolvedValue({ id: 'course-1' });

      await service.permanentDelete('course-1');

      expect(prisma.simulationChatLog.deleteMany).toHaveBeenCalledWith({
        where: { simulation_instance_id: { in: ['inst-1'] } },
      });
      expect(prisma.simulationEvaluation.deleteMany).toHaveBeenCalledWith({
        where: { simulation_id: { in: ['sim-1'] } },
      });
      expect(prisma.simulationAssignment.deleteMany).toHaveBeenCalledWith({ where: { course_id: 'course-1' } });
      expect(prisma.courseDocument.deleteMany).toHaveBeenCalledWith({ where: { course_id: 'course-1' } });
      expect(prisma.flowTemplate.deleteMany).toHaveBeenCalledWith({ where: { course_id: 'course-1' } });
      expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: 'course-1' } });
    });
  });

  describe('enroll()', () => {
    const activeCourse = { id: 'course-1', course_id: 'C1', password_hash: null, is_active: true };

    beforeEach(() => {
      prisma.course.findFirst.mockResolvedValue(activeCourse);
      prisma.simulationAssignment.findFirst.mockResolvedValue(null);
      prisma.simulationAssignment.create.mockResolvedValue({ id: 'assign-1' });
    });

    it('throws ConflictException when student is already enrolled', async () => {
      prisma.simulationAssignment.findFirst.mockResolvedValue({ id: 'existing-assign' });

      await expect(
        service.enroll('course-1', 'student-1'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.simulationAssignment.create).not.toHaveBeenCalled();
    });

    it('does not increment enrollment attempt counter on duplicate', async () => {
      prisma.simulationAssignment.findFirst.mockResolvedValue({ id: 'existing-assign' });

      await expect(
        service.enroll('course-1', 'student-1'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.enrollmentAttempt.create).not.toHaveBeenCalled();
    });

    it('creates assignment on first enrollment', async () => {
      const result = await service.enroll('course-1', 'student-1');

      expect(prisma.simulationAssignment.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'assign-1' });
    });
  });
});
