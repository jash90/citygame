import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CharacterController],
})
export class CharacterModule {}
