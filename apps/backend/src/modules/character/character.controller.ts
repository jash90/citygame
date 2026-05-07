import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('characters')
export class CharacterController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const character = await this.prisma.character.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            orderIndex: true,
            maxPoints: true,
            taskRoleInArc: true,
          },
        },
      },
    });
    if (!character) {
      throw new NotFoundException(`Character ${id} not found`);
    }
    return character;
  }
}
