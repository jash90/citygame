import { IsUUID } from 'class-validator';

export class JoinGameWsDto {
  @IsUUID()
  gameId!: string;
}
