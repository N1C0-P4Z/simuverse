import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EndorsersController } from './missing-controllers';
import { PrismaService } from '../prisma/prisma.service';

describe('EndorsersController — GET /endorsers/active', () => {
  let app: INestApplication;

  const activeEndorsers = [
    { id: 1, name: 'Org A', short_name: 'OA', logo_url: '/a.png', website: 'https://a.test' },
    { id: 2, name: 'Org B', short_name: null, logo_url: null, website: null },
  ];

  beforeAll(async () => {
    const prismaMock = {
      endorser: {
        findMany: jest.fn().mockResolvedValue(activeEndorsers),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EndorsersController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns active endorsers without pagination', async () => {
    const res = await request(app.getHttpServer()).get('/endorsers/active').expect(200);
    expect(res.body).toEqual(activeEndorsers);
  });
});
