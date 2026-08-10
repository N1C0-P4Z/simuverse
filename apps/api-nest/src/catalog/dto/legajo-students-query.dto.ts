import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class LegajoStudentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  course_id?: string;

  @IsOptional()
  @IsString()
  teacher_id?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
