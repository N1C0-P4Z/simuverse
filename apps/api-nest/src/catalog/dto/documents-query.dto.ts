import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class DocumentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  course_id?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
