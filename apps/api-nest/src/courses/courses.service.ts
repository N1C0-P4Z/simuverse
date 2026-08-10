import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CourseRubricService } from '../rubrics/course-rubric.service';

const ENROLL_MAX_ATTEMPTS = 5;
const ENROLL_WINDOW_MS = 15 * 60 * 1000;

const COURSE_ASSOCIATIONS_INCLUDE = {
  course_endorsers: { include: { endorser: true } },
  course_simulated_companies: { include: { simulated_company: true } },
  course_foundation_configs: { include: { foundation_config: true } },
  course_sponsors: { include: { sponsor: true } },
} satisfies Prisma.CourseInclude;

interface CourseAssociationIds {
  endorser_ids?: number[];
  company_ids?: number[];
  foundation_ids?: number[];
  sponsor_ids?: number[];
}

@Injectable()
export class CoursesService {
  constructor(
    private prisma: PrismaService,
    private rubricService: CourseRubricService,
  ) {}

  private stripPassword<T extends { password_hash?: string | null }>(
    course: T,
    extras?: { password_plain?: string },
  ) {
    const { password_hash, ...rest } = course as any;
    return {
      ...rest,
      requires_password: !!password_hash,
      ...(extras?.password_plain ? { password_plain: extras.password_plain } : {}),
    };
  }

  /** Generate a readable enrollment password (no ambiguous chars). */
  generateEnrollmentPassword(length = 10): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  private courseListInclude = {
    teachers: {
      include: {
        teacher: { select: { id: true, name: true, email: true } },
      },
    },
    ...COURSE_ASSOCIATIONS_INCLUDE,
  };

  async findAll(opts?: { page?: number; limit?: number; isActive?: boolean }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, isActive } = opts || {};
    const where = isActive !== undefined ? { is_active: isActive } : {};
    const result = await paginate(this.prisma.course, where, {
      page,
      limit,
      orderBy: { created_at: 'desc' },
      include: this.courseListInclude,
    });
    return {
      ...result,
      data: result.data.map((c) => this.stripPassword(c)),
    };
  }

  async findAllDropdown(isActive?: boolean, teacherId?: string) {
    const where: any = isActive !== undefined ? { is_active: isActive } : {};
    if (teacherId) {
      where.teachers = { some: { teacher_id: teacherId } };
    }
    const courses = await this.prisma.course.findMany({
      where,
      include: this.courseListInclude,
      orderBy: { created_at: 'desc' },
    });
    return courses.map((c) => this.stripPassword(c));
  }

  async findByCourseId(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: {
        teachers: {
          include: {
            teacher: { select: { id: true, name: true, email: true } },
          },
        },
        ...COURSE_ASSOCIATIONS_INCLUDE,
      },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return this.stripPassword(course);
  }

  async findById(id: string) {
    const include = {
      teachers: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
        },
      },
      ...COURSE_ASSOCIATIONS_INCLUDE,
    };
    let course = await this.prisma.course.findUnique({ where: { id }, include });
    if (!course) {
      course = await this.prisma.course.findUnique({ where: { course_id: id }, include });
    }
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return this.stripPassword(course);
  }

  async catalog(opts: { q?: string; tag?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const needle = (opts.q || '').trim().toLowerCase();
    const tag = (opts.tag || '').trim().toLowerCase();

    // Build Prisma where clause
    const where: any = { is_active: true };

    if (needle) {
      where.OR = [
        { title: { contains: needle, mode: 'insensitive' } },
        { category: { contains: needle, mode: 'insensitive' } },
        {
          teachers: {
            some: {
              teacher: {
                OR: [
                  { name: { contains: needle, mode: 'insensitive' } },
                  { email: { contains: needle, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    if (tag) {
      // Filter by the main category field (exact match, case-insensitive)
      where.category = { equals: tag, mode: 'insensitive' };
    }

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: {
          teachers: {
            include: {
              teacher: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { title: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.course.count({ where }),
    ]);

    const courseTags = (c: (typeof courses)[number]): string[] => {
      const cats = Array.isArray(c.categories) ? (c.categories as string[]) : [];
      return [c.category, ...cats].filter(Boolean).map((t) => String(t));
    };

    return {
      data: courses.map((c) => ({
        id: c.id,
        course_id: c.course_id,
        title: c.title,
        description: c.description,
        category: c.category,
        tags: courseTags(c),
        requires_password: !!c.password_hash,
        teachers: c.teachers.map((t) => ({
          id: t.teacher.id,
          name: t.teacher.name,
          email: t.teacher.email,
        })),
      })),
      total,
      page,
      limit,
    };
  }

  /** Syncs one course's *_ids arrays into their junction tables. Undefined = leave untouched; [] = clear all. */
  private async syncAssociations(
    tx: Prisma.TransactionClient,
    courseId: string,
    data: CourseAssociationIds,
  ) {
    const jobs: Array<[keyof CourseAssociationIds, string]> = [
      ['endorser_ids', 'endorser_id'],
      ['company_ids', 'simulated_company_id'],
      ['foundation_ids', 'foundation_config_id'],
      ['sponsor_ids', 'sponsor_id'],
    ];
    const delegates: Record<string, any> = {
      endorser_ids: tx.courseEndorser,
      company_ids: tx.courseSimulatedCompany,
      foundation_ids: tx.courseFoundationConfig,
      sponsor_ids: tx.courseSponsor,
    };

    for (const [key, idField] of jobs) {
      const ids = data[key];
      if (ids === undefined) continue;
      const delegate = delegates[key];
      await delegate.deleteMany({ where: { course_id: courseId } });
      if (ids.length) {
        await delegate.createMany({
          data: ids.map((id: number) => ({ course_id: courseId, [idField]: id })),
        });
      }
    }
  }

  async create(
    data: {
      course_id: string;
      title: string;
      description?: string;
      category: string;
      modules?: any;
      ai_config?: any;
      eval_criteria?: any;
      crisis_events?: any;
      categories?: any;
      is_active?: boolean;
      tech_sheet_id?: number;
      created_by?: string;
      password?: string;
      drive_folder_url?: string | null;
      teacher_ids?: string[];
    } & CourseAssociationIds,
  ) {
    const existing = await this.prisma.course.findUnique({
      where: { course_id: data.course_id },
    });
    if (existing) {
      throw new ConflictException('Course ID already exists');
    }

    const password_hash = data.password
      ? await bcrypt.hash(data.password, 10)
      : null;

    const modules = Array.isArray(data.modules)
      ? data.modules.filter((m: string) => m !== 'evaluacion_auto')
      : data.modules;

    const course = await this.prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          course_id: data.course_id,
          title: data.title,
          description: data.description,
          category: data.category,
          modules: modules || undefined,
          // IA / ficha técnica se configuran desde la ficha ministerial, no en create de curso
          eval_criteria: data.eval_criteria || undefined,
          crisis_events: data.crisis_events || undefined,
          categories: data.categories || undefined,
          is_active: data.is_active ?? true,
          created_by: data.created_by || undefined,
          password_hash,
          drive_folder_url: data.drive_folder_url || null,
        },
      });

      await this.syncAssociations(tx, created.id, data);

      return created;
    });

    if (data.teacher_ids?.length) {
      await this.setTeachers(course.id, data.teacher_ids);
    }

    await this.rubricService.cloneDefaultRubricToCourse(course.id);

    const full = await this.findById(course.id);
    return data.password ? { ...full, password_plain: data.password } : full;
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      category?: string;
      modules?: any;
      ai_config?: any;
      eval_criteria?: any;
      crisis_events?: any;
      categories?: any;
      is_active?: boolean;
      tech_sheet_id?: number;
      created_by?: string;
      password?: string | null;
      clear_password?: boolean;
      drive_folder_url?: string | null;
      teacher_ids?: string[];
    } & CourseAssociationIds,
    actor?: { id: string; role: string },
  ) {
    const {
      created_by,
      password,
      clear_password,
      teacher_ids,
      endorser_ids,
      company_ids,
      foundation_ids,
      sponsor_ids,
      ...rawUpdate
    } = data;
    // IA / ficha / evaluación auto no se editan desde el formulario de curso
    const {
      ai_config: _aiConfig,
      tech_sheet_id: _techSheetId,
      ...restUpdate
    } = rawUpdate as typeof rawUpdate & { ai_config?: unknown; tech_sheet_id?: unknown };
    const updateData = {
      ...restUpdate,
      modules: Array.isArray(restUpdate.modules)
        ? restUpdate.modules.filter((m: string) => m !== 'evaluacion_auto')
        : restUpdate.modules,
    };

    if (actor && actor.role === 'teacher') {
      const isTeacher = await this.prisma.courseTeacher.findFirst({
        where: { course_id: id, teacher_id: actor.id },
      });
      if (!isTeacher) {
        throw new ForbiddenException('Not a teacher of this course');
      }
    }

    const passwordUpdate: { password_hash?: string | null } = {};
    if (clear_password) {
      passwordUpdate.password_hash = null;
    } else if (typeof password === 'string' && password.length > 0) {
      passwordUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.course.update({
          where: { id },
          data: {
            ...updateData,
            ...passwordUpdate,
            modules: updateData.modules || undefined,
            eval_criteria: updateData.eval_criteria || undefined,
            crisis_events: updateData.crisis_events || undefined,
            categories: updateData.categories || undefined,
            drive_folder_url:
              updateData.drive_folder_url === undefined
                ? undefined
                : updateData.drive_folder_url || null,
          },
        });

        await this.syncAssociations(tx, id, {
          endorser_ids,
          company_ids,
          foundation_ids,
          sponsor_ids,
        });
      });

      if (teacher_ids) {
        await this.setTeachers(id, teacher_ids);
      }

      const full = await this.findById(id);
      return typeof password === 'string' && password.length > 0
        ? { ...full, password_plain: password }
        : full;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Course not found');
      }
      throw error;
    }
  }

  async regeneratePassword(id: string, actor?: { id: string; role: string }) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (actor && actor.role === 'teacher') {
      const isTeacher = await this.prisma.courseTeacher.findFirst({
        where: { course_id: id, teacher_id: actor.id },
      });
      if (!isTeacher) {
        throw new ForbiddenException('Not a teacher of this course');
      }
    }

    const password_plain = this.generateEnrollmentPassword();
    const password_hash = await bcrypt.hash(password_plain, 10);
    const updated = await this.prisma.course.update({
      where: { id },
      data: { password_hash },
    });

    return this.stripPassword(
      { ...updated, teachers: [] },
      { password_plain },
    );
  }

  async setTeachers(courseId: string, teacherIds: string[]) {
    await this.prisma.courseTeacher.deleteMany({ where: { course_id: courseId } });
    if (!teacherIds.length) return;
    await this.prisma.courseTeacher.createMany({
      data: teacherIds.map((teacher_id) => ({
        course_id: courseId,
        teacher_id,
      })),
      skipDuplicates: true,
    });
  }

  async enroll(courseId: string, studentId: string, password?: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        OR: [{ id: courseId }, { course_id: courseId }],
        is_active: true,
      },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Check duplicate enrollment BEFORE rate-limit counting
    const existingAssignment = await this.prisma.simulationAssignment.findFirst({
      where: { student_id: studentId, course_id: course.id },
    });
    if (existingAssignment) {
      throw new ConflictException('Ya estás inscrito');
    }

    const since = new Date(Date.now() - ENROLL_WINDOW_MS);
    const recentFails = await this.prisma.enrollmentAttempt.count({
      where: {
        student_id: studentId,
        course_id: course.id,
        success: false,
        created_at: { gte: since },
      },
    });
    if (recentFails >= ENROLL_MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many enrollment attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (course.password_hash) {
      if (!password) {
        await this.prisma.enrollmentAttempt.create({
          data: { student_id: studentId, course_id: course.id, success: false },
        });
        throw new BadRequestException('Course password is required');
      }
      const ok = await bcrypt.compare(password, course.password_hash);
      if (!ok) {
        await this.prisma.enrollmentAttempt.create({
          data: { student_id: studentId, course_id: course.id, success: false },
        });
        throw new ForbiddenException('Incorrect course password');
      }
    }

    const assignment = await this.prisma.simulationAssignment.create({
      data: {
        simulation_id: `self-${Date.now()}`,
        student_id: studentId,
        course_id: course.id,
        assigned_by: studentId,
        status: 'pending',
      },
    });

    await this.prisma.enrollmentAttempt.create({
      data: { student_id: studentId, course_id: course.id, success: true },
    });

    return assignment;
  }

  async remove(id: string) {
    try {
      return await this.prisma.course.update({
        where: { id },
        data: { is_active: false },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Course not found');
      }
      throw error;
    }
  }

  /**
   * Permanently delete a course and everything under it. FK-backed children are
   * removed by ON DELETE CASCADE; the tables below store course/instance/simulation
   * ids WITHOUT a foreign key, so we clean them explicitly to avoid orphan rows.
   */
  async permanentDelete(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.$transaction(async (tx) => {
      const instances = await tx.simulationInstance.findMany({
        where: { course_id: id },
        select: { id: true },
      });
      const simulations = await tx.simulation.findMany({
        where: { course_id: id },
        select: { id: true },
      });
      const instanceIds = instances.map((i) => i.id);
      const simulationIds = simulations.map((s) => s.id);

      if (instanceIds.length) {
        await tx.simulationChatLog.deleteMany({
          where: { simulation_instance_id: { in: instanceIds } },
        });
      }
      if (simulationIds.length) {
        await tx.simulationEvaluation.deleteMany({
          where: { simulation_id: { in: simulationIds } },
        });
      }
      await tx.simulationAssignment.deleteMany({ where: { course_id: id } });
      await tx.courseDocument.deleteMany({ where: { course_id: id } });
      await tx.flowTemplate.deleteMany({ where: { course_id: id } });

      return tx.course.delete({ where: { id } });
    });
  }

  async findCourseSponsors(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        course_sponsors: {
          include: {
            sponsor: true,
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course.course_sponsors
      .map((cs) => cs.sponsor)
      .filter((s) => s && s.is_active);
  }
}
