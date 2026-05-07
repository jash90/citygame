/**
 * Idempotent data migration: extracts Character entities from existing
 * Task.storyContext.characterName values, creates Character rows, and
 * links each Task to its Character via npcId + assigns taskRoleInArc.
 *
 * Run with: npx ts-node scripts/migrate-characters-from-story-context.ts
 *
 * Safe to re-run — uses UPSERT on (gameId, name) and skips tasks that
 * already have npcId set.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface StoryContextShape {
  characterName?: string;
  locationIntro?: string;
  taskNarrative?: string;
  clueRevealed?: string;
}

function parseStoryContext(raw: string | null | undefined): StoryContextShape | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed as StoryContextShape;
    return null;
  } catch {
    return null;
  }
}

async function migrate() {
  console.log('Starting character migration from storyContext...\n');

  // Step 1: Find all tasks with storyContext containing characterName and no npcId yet
  const tasksWithCharacter = await prisma.task.findMany({
    where: {
      storyContext: { not: null },
      npcId: null,
    },
    select: {
      id: true,
      gameId: true,
      storyContext: true,
      orderIndex: true,
    },
  });

  console.log(`Found ${tasksWithCharacter.length} tasks with potential storyContext`);

  // Group by (gameId, characterName)
  const groupedByCharacter = new Map<
    string,
    {
      gameId: string;
      characterName: string;
      taskIds: { id: string; orderIndex: number }[];
    }
  >();

  for (const task of tasksWithCharacter) {
    const sc = parseStoryContext(task.storyContext);
    const characterName = sc?.characterName?.trim();
    if (!characterName) continue;

    const key = `${task.gameId}::${characterName}`;
    if (!groupedByCharacter.has(key)) {
      groupedByCharacter.set(key, {
        gameId: task.gameId,
        characterName,
        taskIds: [],
      });
    }
    groupedByCharacter.get(key)!.taskIds.push({
      id: task.id,
      orderIndex: task.orderIndex,
    });
  }

  console.log(`Grouped into ${groupedByCharacter.size} unique characters\n`);

  // Step 2: For each group, UPSERT Character + UPDATE Task.npcId
  let charactersCreated = 0;
  let tasksUpdated = 0;

  for (const group of groupedByCharacter.values()) {
    const character = await prisma.character.upsert({
      where: {
        gameId_name: {
          gameId: group.gameId,
          name: group.characterName,
        },
      },
      create: {
        gameId: group.gameId,
        name: group.characterName,
        archetype: 'nieokreślony',
        roleFunction: 'UNKNOWN',
        voiceTrait: 'styl wypowiedzi do uzupełnienia',
        importance: 3,
      },
      update: {},
    });
    charactersCreated++;

    // Heuristic taskRoleInArc based on order
    const sortedTasks = [...group.taskIds].sort((a, b) => a.orderIndex - b.orderIndex);

    for (let i = 0; i < sortedTasks.length; i++) {
      const t = sortedTasks[i];
      let taskRole: 'INTRODUCTION' | 'DEEPENING' | 'CLIMAX' | null = null;

      if (sortedTasks.length === 1) {
        taskRole = null;
      } else if (i === 0) {
        taskRole = 'INTRODUCTION';
      } else if (i === sortedTasks.length - 1) {
        taskRole = 'CLIMAX';
      } else {
        taskRole = 'DEEPENING';
      }

      await prisma.task.update({
        where: { id: t.id },
        data: {
          npcId: character.id,
          taskRoleInArc: taskRole,
        },
      });
      tasksUpdated++;
    }
  }

  // Step 3: Set storyMode = FLAVOR for games that have characters
  const gamesWithCharacters = await prisma.game.findMany({
    where: {
      characters: { some: {} },
      storyMode: 'NONE',
    },
    select: { id: true, title: true },
  });

  for (const game of gamesWithCharacters) {
    await prisma.game.update({
      where: { id: game.id },
      data: { storyMode: 'FLAVOR' },
    });
    console.log(`  Set storyMode=FLAVOR for game "${game.title}" (${game.id})`);
  }

  console.log(`\n✓ Characters created/upserted: ${charactersCreated}`);
  console.log(`✓ Tasks updated with npcId: ${tasksUpdated}`);
  console.log(`✓ Games migrated to storyMode=FLAVOR: ${gamesWithCharacters.length}`);
}

migrate()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
