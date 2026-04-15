import { PrismaClient, GameStatus, TaskType, UnlockMethod } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { cleanGames } from './seed-utils';

export async function seedKrakowGame(
  prisma: PrismaClient,
  adminId: string,
  _janId: string,
  _annaId: string,
  _marekId: string,
) {
  await cleanGames(prisma, ['Śladami Historii Krakowa']);

  const [zygmuntHash, zapiekankaHash] = await Promise.all([
    bcrypt.hash('zygmunt', 10),
    bcrypt.hash('zapiekanka', 10),
  ]);

  const game = await prisma.game.create({
    data: {
      title: 'Śladami Historii Krakowa',
      description:
        'Wyrusz na niezapomnianą podróż śladami historii Krakowa. Odkrywaj legendy, zabytki i tajemnice królewskiego miasta.',
      city: 'Kraków',
      status: GameStatus.PUBLISHED,
      settings: { maxPlayers: 200, allowHints: true, timeLimitMinutes: 180 },
      creatorId: adminId,
      tasks: {
        create: [
          {
            title: 'Smok Wawelski',
            description:
              'Odszukaj legendarną jaskinię Smoka Wawelskiego u podnóża Wawelu. Zeskanuj kod QR ukryty przy wejściu do jaskini.',
            type: TaskType.QR_SCAN,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 0,
            latitude: 50.054,
            longitude: 19.9352,
            unlockConfig: { radiusMeters: 80, targetLat: 50.054, targetLng: 19.9352 },
            verifyConfig: { expectedHash: 'sha256:smok_wawelski_2024' },
            maxPoints: 100,
            timeLimitSec: 600,
            hints: {
              create: [
                { orderIndex: 0, content: 'Szukaj przy jaskini smoka', pointPenalty: 10 },
                { orderIndex: 1, content: 'Pod Wawelem, nad Wisłą', pointPenalty: 20 },
              ],
            },
          },
          {
            title: 'Tajemnica katedry wawelskiej',
            description:
              'Stojąc przed katedrą wawelską, odpowiedz na pytanie: jak nazywa się największy dzwon w Polsce, wiszący na wieży katedry? Wpisz samo imię (małymi literami).',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 1,
            latitude: 50.0543,
            longitude: 19.9356,
            unlockConfig: { radiusMeters: 60, targetLat: 50.0543, targetLng: 19.9356 },
            verifyConfig: { answerHash: zygmuntHash },
            maxPoints: 80,
            timeLimitSec: null,
          },
          {
            title: 'Sukiennice — Zrób zdjęcie',
            description:
              'Zrób zdjęcie Sukiennic na Rynku Głównym w Krakowie. Upewnij się, że na zdjęciu widoczna jest charakterystyczna renesansowa attyka.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 2,
            latitude: 50.0617,
            longitude: 19.9373,
            unlockConfig: { radiusMeters: 100, targetLat: 50.0617, targetLng: 19.9373 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia Sukiennice na Rynku Głównym w Krakowie. Szukaj charakterystycznej renesansowej attyki.',
              threshold: 0.6,
            },
            maxPoints: 150,
            timeLimitSec: null,
          },
          {
            title: 'Kościół Mariacki — Hejnał',
            description:
              'Przy kościele Mariackim odpowiedz na pytanie: dlaczego hejnał mariacki urywa się nagle w połowie melodii?',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.QR,
            orderIndex: 3,
            latitude: 50.0617,
            longitude: 19.9394,
            unlockConfig: { qrCode: 'KOSCIOL_MARIACKI_HEJNAL' },
            verifyConfig: {
              prompt:
                'Oceń odpowiedź na pytanie: Dlaczego hejnał mariacki urywa się w połowie? Poprawna odpowiedź powinna wspomnieć o tatarskim łuczniku.',
              threshold: 0.65,
            },
            maxPoints: 120,
            timeLimitSec: 300,
          },
          {
            title: 'Barbakan',
            description:
              'Podejdź do Barbakanu — gotyckiej fortecy broniącej niegdyś wjazdu do Krakowa. System zweryfikuje Twoje położenie GPS.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 4,
            latitude: 50.0653,
            longitude: 19.9418,
            unlockConfig: { radiusMeters: 80, targetLat: 50.0653, targetLng: 19.9418 },
            verifyConfig: {
              targetLat: 50.0653,
              targetLng: 19.9418,
              radiusMeters: 30,
            },
            maxPoints: 60,
            timeLimitSec: null,
          },
          {
            title: 'Collegium Maius',
            description:
              'Odszukaj wejście do Collegium Maius — najstarszego budynku Uniwersytetu Jagiellońskiego. Zeskanuj kod QR przy bramie.',
            type: TaskType.QR_SCAN,
            unlockMethod: UnlockMethod.QR,
            orderIndex: 5,
            latitude: 50.0618,
            longitude: 19.9332,
            unlockConfig: { qrCode: 'COLLEGIUM_MAIUS_BRAMA' },
            verifyConfig: { expectedHash: 'sha256:collegium_maius_2024' },
            maxPoints: 90,
            timeLimitSec: null,
          },
          {
            title: 'Kazimierz — Plac Nowy',
            description:
              'Stoisz na Placu Nowym w Kazimierzu, słynącym z ulicznego jedzenia. Jak nazywa się kultowe krakowskie danie serwowane tutaj przez całą dobę?',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 6,
            latitude: 50.051,
            longitude: 19.9455,
            unlockConfig: { radiusMeters: 70, targetLat: 50.051, targetLng: 19.9455 },
            verifyConfig: { answerHash: zapiekankaHash },
            maxPoints: 70,
            timeLimitSec: null,
          },
          {
            title: 'Kopiec Kościuszki',
            description:
              'Zrób zdjęcie Kopca Kościuszki widocznego na wzgórzu. Uwiecznij ten wyjątkowy pomnik usypany z ziemi z pól bitewnych, gdzie walczył Tadeusz Kościuszko.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 7,
            latitude: 50.0545,
            longitude: 19.8932,
            unlockConfig: { radiusMeters: 150, targetLat: 50.0545, targetLng: 19.8932 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia Kopiec Kościuszki w Krakowie, widoczny z daleka na wzgórzu.',
              threshold: 0.6,
            },
            maxPoints: 200,
            timeLimitSec: null,
          },
        ],
      },
    },
    include: {
      tasks: { orderBy: { orderIndex: 'asc' } },
    },
  });

  console.log(`Game "${game.title}" created with ${game.tasks.length} tasks.`);
  return game;
}
