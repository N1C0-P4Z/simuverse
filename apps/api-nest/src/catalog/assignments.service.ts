import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    student_id?: string;
    course_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, ...queryFilters } = filters || {};
    const where: any = {};
    if (queryFilters.student_id) where.student_id = queryFilters.student_id;
    if (queryFilters.course_id) where.course_id = queryFilters.course_id;
    if (queryFilters.status) where.status = queryFilters.status;

    const result = await paginate(this.prisma.simulationAssignment, where, {
      page,
      limit,
      orderBy: { created_at: 'desc' },
    });

    // Enrich with course data (no Prisma relation on SimulationAssignment)
    const enriched = await Promise.all(
      result.data.map(async (a: any) => {
        const course = await this.prisma.course.findUnique({
          where: { id: a.course_id },
          select: { title: true, category: true },
        });
        return {
          ...a,
          course_title: course?.title || '',
          course_category: course?.category || '',
        };
      })
    );

    return { ...result, data: enriched };
  }

  async findOne(id: number) {
    const assignment = await this.prisma.simulationAssignment.findUnique({
      where: { id },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }

  async create(dto: CreateAssignmentDto) {
    return this.prisma.simulationAssignment.create({
      data: {
        simulation_id: dto.simulation_id,
        student_id: dto.student_id,
        course_id: dto.course_id,
        assigned_by: dto.assigned_by,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        max_attempts: dto.max_attempts || 1,
        status: 'pending',
        attempts_used: 0,
      },
    });
  }

  async update(id: number, dto: UpdateAssignmentDto) {
    await this.findOne(id);
    return this.prisma.simulationAssignment.update({
      where: { id },
      data: {
        ...(dto.start_date && { start_date: new Date(dto.start_date) }),
        ...(dto.end_date && { end_date: new Date(dto.end_date) }),
        ...(dto.max_attempts && { max_attempts: dto.max_attempts }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.simulationAssignment.delete({ where: { id } });
    return { message: 'Assignment deleted successfully' };
  }

  async findByStudent(studentId: string) {
    return this.prisma.simulationAssignment.findMany({
      where: { student_id: studentId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findByCourse(courseId: string) {
    return this.prisma.simulationAssignment.findMany({
      where: { course_id: courseId },
      orderBy: { created_at: 'desc' },
    });
  }
}
