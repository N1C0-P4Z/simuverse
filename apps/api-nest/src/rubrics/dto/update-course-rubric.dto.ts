import {
  IsString,
  IsInt,
  IsArray,
  IsOptional,
  IsBoolean,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRubricLevelDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsInt()
  @Min(1)
  value: number;

  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  sort_order: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRubricCriterionDescriptorDto {
  @IsInt()
  @Min(1)
  level_value: number;

  @IsString()
  @MinLength(1)
  descriptor: string;
}

export class UpdateRubricCriterionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  sort_order: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRubricCriterionDescriptorDto)
  descriptors: UpdateRubricCriterionDescriptorDto[];
}

export class UpdateCourseRubricDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(1)
  pass_threshold: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRubricLevelDto)
  levels: UpdateRubricLevelDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRubricCriterionDto)
  criteria: UpdateRubricCriterionDto[];
}
