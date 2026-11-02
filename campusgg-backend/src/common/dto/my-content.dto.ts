import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class MyContentQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}

// A personal-content summary never exposes user entities or account fields.
export class MyContentItemDto {
  id!: string;
  title!: string;
  preview!: string;
  createdAt!: Date;
}

export class MyContentPageDto {
  items!: MyContentItemDto[];
  total!: number;
  page!: number;
  limit!: number;
}
