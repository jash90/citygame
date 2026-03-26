import { IsString, Matches, MaxLength } from 'class-validator';

export class PresignRequestDto {
  @IsString()
  @MaxLength(500)
  key!: string;

  @IsString()
  @Matches(/^[a-z]+\/[a-z0-9.+-]+$/, { message: 'contentType must be a valid MIME type' })
  contentType!: string;
}
