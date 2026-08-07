import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { UpdateFileDto } from './dto/file.dto';
import { ALLOWED_EXTENSIONS } from '@simuverse/shared';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class FilesService {
  private uploadsDir: string;

  constructor(private prisma: PrismaService) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  static computeSha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  static getFileExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    return ext || 'txt';
  }

  async upload(file: Express.Multer.File, metadata: {
    uploaded_by_id: string;
    upload_type: string;
    course_id?: string;
    ministry_requirement_id?: string;
    simulation_instance_id?: string;
    description?: string;
  }) {
    if (!file) throw new BadRequestException('No file provided');

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(
        `El archivo supera el máximo de 5 MB. Usá el link de Drive del curso para archivos más grandes.`,
      );
    }

    const fileExt = `.${FilesService.getFileExtension(file.originalname)}`;
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(fileExt)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido (${fileExt}). Extensiones permitidas: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    let courseId = metadata.course_id || null;

    if (metadata.simulation_instance_id) {
      const instance = await this.prisma.simulationInstance.findUnique({
        where: { id: metadata.simulation_instance_id },
        select: { id: true, student_id: true, course_id: true },
      });
      if (!instance) {
        throw new BadRequestException('Simulation session not found');
      }
      if (instance.student_id !== metadata.uploaded_by_id) {
        throw new ForbiddenException('You can only upload files to your own session');
      }
      courseId = courseId || instance.course_id;
    }

    const uuid = require('crypto').randomUUID();
    const ext = FilesService.getFileExtension(file.originalname);
    const filename = `${uuid}.${ext}`;
    const filePath = path.join(this.uploadsDir, filename);

    fs.writeFileSync(filePath, file.buffer);

    const fileHash = FilesService.computeSha256(file.buffer);

    const created = await this.prisma.fileUpload.create({
      data: {
        uploaded_by_id: metadata.uploaded_by_id,
        course_id: courseId,
        ministry_requirement_id: metadata.ministry_requirement_id || null,
        simulation_instance_id: metadata.simulation_instance_id || null,
        file_name: file.originalname,
        file_type: ext,
        upload_type: (metadata.upload_type || 'student_submission') as any,
        file_size_bytes: BigInt(file.size),
        file_path: filePath,
        file_hash: fileHash,
        description: metadata.description,
        is_active: true,
      },
    });

    const serialized = this.serialize(created);

    return {
      ...serialized,
      file_url: `/api/files/${serialized.id}/download`,
    };
  }

  async findAll(params: {
    uploaded_by_id?: string;
    course_id?: string;
    simulation_instance_id?: string;
  }) {
    const where: any = { is_active: true };
    if (params.uploaded_by_id) where.uploaded_by_id = params.uploaded_by_id;
    if (params.course_id) where.course_id = params.course_id;
    if (params.simulation_instance_id) {
      where.simulation_instance_id = params.simulation_instance_id;
    }

    const files = await this.prisma.fileUpload.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return files.map((f) => this.serialize(f));
  }

  async findOne(id: string) {
    const file = await this.prisma.fileUpload.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    return this.serialize(file);
  }

  async getFilePath(id: string): Promise<{ filePath: string; fileName: string }> {
    const file = await this.findOne(id);
    if (!fs.existsSync(file.file_path)) {
      throw new NotFoundException('File not found on disk');
    }
    return { filePath: file.file_path, fileName: file.file_name };
  }

  async update(id: string, dto: UpdateFileDto, user: any) {
    const file = await this.findOne(id);
    if (user.role === 'student' && file.uploaded_by_id !== user.id) {
      throw new ForbiddenException('You can only update your own files');
    }
    const data: any = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.course_id !== undefined) data.course_id = dto.course_id;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    return this.prisma.fileUpload.update({ where: { id }, data });
  }

  async remove(id: string, user: any) {
    const file = await this.findOne(id);
    if (user.role === 'student' && file.uploaded_by_id !== user.id) {
      throw new ForbiddenException('You can only delete your own files');
    }
    await this.prisma.fileUpload.update({
      where: { id },
      data: { is_active: false },
    });
    return { message: 'File deleted successfully' };
  }

  private serialize<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ));
  }
}
