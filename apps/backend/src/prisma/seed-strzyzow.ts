import { PrismaClient, GameStatus, TaskType, UnlockMethod } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { cleanGames } from './seed-utils';

export async function seedStrzyzowGame(
  prisma: PrismaClient,
  adminId: string,
) {
  await cleanGames(prisma, ['Tajemnice Strzyżowa']);

  const [wislokHash, synagogaHash] = await Promise.all([
    bcrypt.hash('wisłok', 10),
    bcrypt.hash('synagoga', 10),
  ]);

  const strzyzowGame = await prisma.game.create({
    data: {
      title: 'Tajemnice Strzyżowa',
      description:
        'Wyrusz na wyprawę po malowniczym Strzyżowie — odkryj historię, zabytki i tajemnice tego urokliwego miasteczka na Podkarpaciu.',
      city: 'Strzyżów',
      status: GameStatus.PUBLISHED,
      settings: { maxPlayers: 100, allowHints: true, timeLimitMinutes: 150 },
      creatorId: adminId,
      tasks: {
        create: [
          {
            title: 'Pomnik Niepodległości',
            description:
              'Rozpocznij swoją przygodę na strzyżowskim Rynku! Podejdź do Pomnika Niepodległości, który upamiętnia odzyskanie wolności w 1918 roku.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 0,
            latitude: 49.8685,
            longitude: 21.7877,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8685, targetLng: 21.7877 },
            verifyConfig: { targetLat: 49.8685, targetLng: 21.7877, radiusMeters: 30 },
            maxPoints: 60,
            timeLimitSec: null,
          },
          {
            title: 'Kościół Niepokalanego Poczęcia NMP',
            description:
              'Zrób zdjęcie kościoła parafialnego pw. Niepokalanego Poczęcia NMP. Zwróć uwagę na charakterystyczną wieżę i barokowe elementy fasady.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 1,
            latitude: 49.8678,
            longitude: 21.7851,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8678, targetLng: 21.7851 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia kościół katolicki z wieżą i barokową fasadą. Powinien być widoczny budynek sakralny.',
              threshold: 0.6,
            },
            maxPoints: 120,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Kościół znajduje się przy południowej stronie Rynku', pointPenalty: 10 },
                { orderIndex: 1, content: 'Szukaj budynku z charakterystyczną wieżą kościelną', pointPenalty: 20 },
              ],
            },
          },
          {
            title: 'Zespół dworski Wołkowickich',
            description:
              'Stoisz przed zabytkowym zespołem dworskim Wołkowickich. Odpowiedz: jaką rolę pełnił dwór szlachecki w życiu małego miasteczka w XVIII i XIX wieku?',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 2,
            latitude: 49.8731,
            longitude: 21.7698,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8731, targetLng: 21.7698 },
            verifyConfig: {
              prompt:
                'Oceń odpowiedź o rolę dworu szlacheckiego. Poprawna odpowiedź powinna wspomnieć o co najmniej jednym z: centrum administracyjne, patronat kulturalny, ośrodek gospodarczy.',
              threshold: 0.6,
            },
            maxPoints: 130,
            timeLimitSec: 300,
            hints: {
              create: [
                { orderIndex: 0, content: 'Pomyśl o funkcjach: administracja, kultura, gospodarka', pointPenalty: 15 },
              ],
            },
          },
          {
            title: 'Park Miejski nad rzeką',
            description:
              'Spaceruj do parku miejskiego nad rzeką. Zrób zdjęcie alejki parkowej z widokiem na rzekę lub mostkiem.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 3,
            latitude: 49.8644,
            longitude: 21.8005,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8644, targetLng: 21.8005 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia park miejski — szukaj alejek, zieleni, ławek, drzew lub widoku na rzekę.',
              threshold: 0.55,
            },
            maxPoints: 100,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Szukaj zielonego terenu z alejkami nad rzeką', pointPenalty: 10 },
                { orderIndex: 1, content: 'Skieruj się w stronę rzeki, na południe od Rynku', pointPenalty: 20 },
              ],
            },
          },
          {
            title: 'Zagadka na moście',
            description:
              'Stoisz na moście nad rzeką przepływającą przez Strzyżów. Jak nazywa się ta rzeka? Wpisz jej nazwę (małymi literami, z polskimi znakami).',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 4,
            latitude: 49.8672,
            longitude: 21.7926,
            unlockConfig: { radiusMeters: 70, targetLat: 49.8672, targetLng: 21.7926 },
            verifyConfig: { answerHash: wislokHash },
            maxPoints: 70,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Ta rzeka jest dopływem Sanu', pointPenalty: 10 },
              ],
            },
          },
          {
            title: 'Cmentarz Wojenny z I Wojny Światowej',
            description:
              'Odwiedź cmentarz wojenny — miejsce pamięci żołnierzy poległych na froncie galicyjskim. Zrób zdjęcie nagrobków lub pomnika centralnego.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 5,
            latitude: 49.8722,
            longitude: 21.7833,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8722, targetLng: 21.7833 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia cmentarz wojenny — szukaj nagrobków wojskowych, krzyży cmentarnych lub pomnika pamiątkowego.',
              threshold: 0.55,
            },
            maxPoints: 150,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Cmentarz znajduje się na północny wschód od centrum miasta', pointPenalty: 15 },
                { orderIndex: 1, content: 'Szukaj miejsca z wojskowymi nagrobkami i krzyżami', pointPenalty: 25 },
              ],
            },
          },
          {
            title: 'Wielokulturowe dziedzictwo',
            description:
              'Przed Tobą zabytkowy budynek — świadectwo wielokulturowej przeszłości Strzyżowa. Jak nazywa się typ budynku, w którym modlili się wyznawcy judaizmu? (jedno słowo, małymi literami)',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 6,
            latitude: 49.8693,
            longitude: 21.7866,
            unlockConfig: { radiusMeters: 60, targetLat: 49.8693, targetLng: 21.7866 },
            verifyConfig: { answerHash: synagogaHash },
            maxPoints: 80,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Odpowiedź to nazwa tego typu budynku sakralnego', pointPenalty: 10 },
                { orderIndex: 1, content: 'Nazwa pochodzi od greckiego słowa', pointPenalty: 15 },
              ],
            },
          },
          {
            title: 'Wzgórza Strzyżowskie — Panorama',
            description:
              'Na koniec wyprawy wejdź na jedno ze wzgórz otaczających Strzyżów, by podziwiać panoramę miasta i okolicznych Pogórzy.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 7,
            latitude: 49.8807,
            longitude: 21.8021,
            unlockConfig: { radiusMeters: 150, targetLat: 49.8807, targetLng: 21.8021 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia panoramę małego miasta widzianego ze wzgórza. Szukaj widoku z góry na zabudowę w dolinie.',
              threshold: 0.5,
            },
            maxPoints: 200,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Punkt widokowy jest na wzgórzach na północny zachód od centrum', pointPenalty: 20 },
                { orderIndex: 1, content: 'Zrób zdjęcie z wysokiego miejsca — panorama powinna obejmować całe miasto', pointPenalty: 30 },
              ],
            },
          },
        ],
      },
    },
    include: {
      tasks: { orderBy: { orderIndex: 'asc' } },
    },
  });

  console.log(`Game "${strzyzowGame.title}" created with ${strzyzowGame.tasks.length} tasks.`);
  return strzyzowGame;
}
