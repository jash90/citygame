import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type SyncItemType = 'submit' | 'hint' | 'unlock';

export class SyncItemDto {
  @IsUUID()
  clientSubmissionId!: string;

  @IsIn(['submit', 'hint', 'unlock'] satisfies SyncItemType[])
  type!: SyncItemType;

  @IsString()
  taskId!: string;

  /** Submission payload for type=submit; unlock payload for type=unlock; ignored for type=hint. */
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  /** Client-side wall-clock at the moment the player completed the action. */
  @IsOptional()
  @IsString()
  capturedAt?: string;
}

export class SyncRequestDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  items!: SyncItemDto[];
}
