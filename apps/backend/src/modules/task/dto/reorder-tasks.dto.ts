import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class TaskOrderItem {
  @IsUUID()
  id!: string;

  @IsInt()
  @Min(0)
  orderIndex!: number;
}

export class ReorderTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TaskOrderItem)
  tasks!: TaskOrderItem[];
}
