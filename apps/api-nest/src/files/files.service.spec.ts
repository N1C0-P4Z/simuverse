import { BadRequestException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FilesService — extension whitelist', () => {
  let service: FilesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      fileUpload: { create: jest.fn().mockResolvedValue({ id: 'file-1' }) },
      simulationInstance: { findUnique: jest.fn() },
    };
    // Stub constructor side-effects (mkdirSync)
    jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
    jest.spyOn(require('fs'), 'mkdirSync').mockImplementation(() => {});
    jest.spyOn(require('fs'), 'writeFileSync').mockImplementation(() => {});

    service = new FilesService(prisma as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeFile(originalname: string, mimetype = 'application/pdf'): Express.Multer.File {
    return {
      originalname,
      mimetype,
      buffer: Buffer.from('test'),
      size: 1024,
    } as Express.Multer.File;
  }

  it('accepts .pdf files (allowed extension)', async () => {
    prisma.simulationInstance.findUnique.mockResolvedValue(null);
    prisma.fileUpload.create.mockResolvedValue({
      id: 'file-1',
      file_name: 'report.pdf',
      file_type: 'pdf',
      file_size_bytes: BigInt(1024),
      file_path: '/tmp/report.pdf',
      file_hash: 'abc',
    });

    const result = await service.upload(makeFile('report.pdf', 'application/pdf'), {
      uploaded_by_id: 'user-1',
      upload_type: 'student_submission',
    });

    expect(result).toBeDefined();
    expect(prisma.fileUpload.create).toHaveBeenCalled();
  });

  it('rejects .exe files (not in whitelist)', async () => {
    await expect(
      service.upload(makeFile('script.exe', 'application/octet-stream'), {
        uploaded_by_id: 'user-1',
        upload_type: 'student_submission',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.fileUpload.create).not.toHaveBeenCalled();
  });

  it('rejects .zip files (not in whitelist)', async () => {
    await expect(
      service.upload(makeFile('archive.zip', 'application/zip'), {
        uploaded_by_id: 'user-1',
        upload_type: 'student_submission',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.fileUpload.create).not.toHaveBeenCalled();
  });
});
