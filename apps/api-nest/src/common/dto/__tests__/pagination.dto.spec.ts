import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto } from '../pagination.dto';

async function validateDto(input: Record<string, unknown>) {
  const dto = plainToInstance(PaginationDto, input);
  return validate(dto as object);
}

describe('PaginationDto', () => {
  describe('defaults', () => {
    it('defaults page to 1 when not provided', () => {
      const dto = plainToInstance(PaginationDto, {});
      expect(dto.page).toBe(1);
    });

    it('defaults limit to 20 when not provided', () => {
      const dto = plainToInstance(PaginationDto, {});
      expect(dto.limit).toBe(20);
    });
  });

  describe('valid input', () => {
    it('accepts valid page and limit', async () => {
      const errors = await validateDto({ page: 2, limit: 50 });
      expect(errors).toHaveLength(0);
    });

    it('accepts page=1 and limit=1 (minimums)', async () => {
      const errors = await validateDto({ page: 1, limit: 1 });
      expect(errors).toHaveLength(0);
    });

    it('accepts limit=100 (maximum)', async () => {
      const errors = await validateDto({ limit: 100 });
      expect(errors).toHaveLength(0);
    });
  });

  describe('validation', () => {
    it('rejects limit > 100', async () => {
      const errors = await validateDto({ limit: 101 });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('transform — clamps malformed input', () => {
    it('transforms string page to number', () => {
      const dto = plainToInstance(PaginationDto, { page: '3', limit: '25' });
      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(25);
    });

    it('clamps page to 1 for non-numeric string', () => {
      const dto = plainToInstance(PaginationDto, { page: 'abc' });
      expect(dto.page).toBe(1);
    });

    it('clamps limit to 20 for non-numeric string', () => {
      const dto = plainToInstance(PaginationDto, { limit: 'xyz' });
      expect(dto.limit).toBe(20);
    });

    it('clamps negative page to 1', () => {
      const dto = plainToInstance(PaginationDto, { page: '-5' });
      expect(dto.page).toBe(1);
    });

    it('clamps zero page to 1', () => {
      const dto = plainToInstance(PaginationDto, { page: '0' });
      expect(dto.page).toBe(1);
    });

    it('clamps zero limit to 20', () => {
      const dto = plainToInstance(PaginationDto, { limit: '0' });
      expect(dto.limit).toBe(20);
    });
  });
});
