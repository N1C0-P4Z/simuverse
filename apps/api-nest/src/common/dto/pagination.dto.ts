import { Type, Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num) || num < 1) return 1;
    return Math.floor(num);
  })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num) || num < 1) return 20;
    return Math.floor(num);
  })
  limit: number = 20;
}
