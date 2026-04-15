import { PrismaClient, GameStatus, TaskType, UnlockMethod } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { cleanGames } from './seed-utils';

const sc = (ctx: Record<string, string>) => JSON.stringify(ctx);

export async function seedNarrativeGame(prisma: PrismaClient, adminId: string) {
  await cleanGames(prisma, ['Zagubiony Rękopis Kronikarza']);

  const [rekopisHash] = await Promise.all([
    bcrypt.hash('wisłok', 10), // cipher answer
  ]);

  const narrativeGame = await prisma.game.create({
    data: {
      title: 'Zagubiony Rękopis Kronikarza',
      description:
        'Rok 1782. Kronikarz Maciej Bielicki ukrył w Strzyżowie rękopis z tajemnicą założenia miasta. Podążaj jego śladami, zbieraj fragmenty i rozwiąż zagadkę sprzed wieków.',
      city: 'Strzyżów',
      status: GameStatus.PUBLISHED,
      settings: {
        maxPlayers: 100,
        allowHints: true,
        timeLimitMinutes: 180,
        narrative: {
          isNarrative: true,
          theme: 'Tajemnica literacka',
          prologue:
            'Strzyżów, rok 1782. Miejski kronikarz Maciej Bielicki spisywał dzieje miasteczka od lat.\n\nNa łożu śmierci wyszeptał jedynie: "Kto zbierze wszystkie fragmenty, pozna prawdziwą historię Strzyżowa."',
          epilogue:
            'Zebrałeś wszystkie fragmenty rękopisu Bielickiego. Kronikarz odkrył prawdę o wielokulturowej jedności Strzyżowa.',
        },
      },
      creatorId: adminId,
      tasks: {
        create: [
          {
            title: 'Serce miasta', description: 'Podejdź do centrum Rynku w Strzyżowie.',
            type: TaskType.GPS_REACH, unlockMethod: UnlockMethod.GPS, orderIndex: 0,
            latitude: 49.8685, longitude: 21.7877,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8685, targetLng: 21.7877 },
            verifyConfig: { targetLat: 49.8685, targetLng: 21.7877, radiusMeters: 30 },
            maxPoints: 50, timeLimitSec: null,
            storyContext: sc({ characterName: 'Stary Kronikarz', locationIntro: 'Stoisz na Rynku — od wieków sercu Strzyżowa.', taskNarrative: '„Serce miasta bije tu, na Rynku..."', clueRevealed: 'Prawda leży tam, gdzie dzwony biją od wieków' }),
          },
          {
            title: 'Duchowe centrum', description: 'Zrób zdjęcie kościoła parafialnego.',
            type: TaskType.PHOTO_AI, unlockMethod: UnlockMethod.GPS, orderIndex: 1,
            latitude: 49.8678, longitude: 21.7851,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8678, targetLng: 21.7851 },
            verifyConfig: { prompt: 'Oceń czy zdjęcie przedstawia kościół z wieżą i barokową fasadą.', threshold: 0.6 },
            maxPoints: 100, timeLimitSec: null,
            storyContext: sc({ characterName: 'Stary Kronikarz', locationIntro: 'Kolegiata wznosi się nad miastem od XVIII wieku.', taskNarrative: 'Drugi fragment schowano w kronice parafialnej.', clueRevealed: 'Woda, która dzieli, również łączy' }),
            hints: { create: [{ orderIndex: 0, content: 'Kościół stoi przy południowej stronie Rynku', pointPenalty: 10 }] },
          },
          {
            title: 'Strażnik przeprawy', description: 'Podejdź do mostu na Wisłoku.',
            type: TaskType.GPS_REACH, unlockMethod: UnlockMethod.GPS, orderIndex: 2,
            latitude: 49.8672, longitude: 21.7926,
            unlockConfig: { radiusMeters: 70, targetLat: 49.8672, targetLng: 21.7926 },
            verifyConfig: { targetLat: 49.8672, targetLng: 21.7926, radiusMeters: 30 },
            maxPoints: 50, timeLimitSec: null,
            storyContext: sc({ characterName: 'Stary Kronikarz', locationIntro: 'Wisłok — rzeka towarzysząca Strzyżowowi.', taskNarrative: 'Trzeci fragment ukryto pod kamieniem przy moście.', clueRevealed: 'Gdzie spoczywają odeszli, prawda wykuta w kamieniu' }),
          },
          {
            title: 'Pamięć pokoleń', description: 'Opisz co czujesz w tym miejscu pamięci.',
            type: TaskType.TEXT_AI, unlockMethod: UnlockMethod.GPS, orderIndex: 3,
            latitude: 49.8722, longitude: 21.7833,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8722, targetLng: 21.7833 },
            verifyConfig: { prompt: 'Oceń czy odpowiedź jest refleksją na temat pamięci o poległych.', threshold: 0.5 },
            maxPoints: 120, timeLimitSec: 300,
            storyContext: sc({ characterName: 'Stary Kronikarz', locationIntro: 'Tu spoczywają ci, którzy oddali życie za tę ziemię.', taskNarrative: 'Czwarty fragment znaleziono na nagrobku.', clueRevealed: 'Dom modlitwy, co stał tu niegdyś, ma ściany co szepczą' }),
            hints: { create: [{ orderIndex: 0, content: 'Napisz o swoich osobistych uczuciach', pointPenalty: 15 }] },
          },
          {
            title: 'Głosy przeszłości', description: 'Napisz, dlaczego pamięć o wielokulturowej przeszłości jest ważna.',
            type: TaskType.TEXT_AI, unlockMethod: UnlockMethod.GPS, orderIndex: 4,
            latitude: 49.8693, longitude: 21.7866,
            unlockConfig: { radiusMeters: 60, targetLat: 49.8693, targetLng: 21.7866 },
            verifyConfig: { prompt: 'Oceń czy odpowiedź zawiera refleksję na temat wielokulturowości.', threshold: 0.5 },
            maxPoints: 120, timeLimitSec: 300,
            storyContext: sc({ characterName: 'Stary Kronikarz', locationIntro: 'Tu stała synagoga.', taskNarrative: 'Piąty fragment przechowywał żydowski aptekarz.', clueRevealed: 'Szlacheckie mury kryją szlacheckie sekrety' }),
          },
          {
            title: 'Szlacheckie sekrety', description: 'Zrób zdjęcie Pałacu Wołkowickich-Konopków.',
            type: TaskType.PHOTO_AI, unlockMethod: UnlockMethod.GPS, orderIndex: 5,
            latitude: 49.8731, longitude: 21.7698,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8731, targetLng: 21.7698 },
            verifyConfig: { prompt: 'Oceń czy zdjęcie przedstawia zabytkowy budynek o historycznej architekturze.', threshold: 0.55 },
            maxPoints: 100, timeLimitSec: null,
            storyContext: sc({ characterName: 'Stary Kronikarz', locationIntro: 'Pałac Wołkowickich — niegdyś siedziba rodu.', taskNarrative: 'Szósty fragment ukryto w bibliotece dworu.', clueRevealed: 'W ogrodzie spokoju natura zdradza wzór' }),
            hints: { create: [{ orderIndex: 0, content: 'Szukaj budynku o historycznej architekturze przy ul. Sobieskiego', pointPenalty: 15 }] },
          },
          {
            title: 'Szyfr kronikarza', description: 'Pierwsze litery wskazówek tworzą słowo-klucz. Wpisz odpowiedź.',
            type: TaskType.CIPHER, unlockMethod: UnlockMethod.GPS, orderIndex: 6,
            latitude: 49.8644, longitude: 21.8005,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8644, targetLng: 21.8005 },
            verifyConfig: { answerHash: rekopisHash, cipherHint: 'Przeczytaj pierwsze litery każdej wskazówki...' },
            maxPoints: 150, timeLimitSec: null,
            storyContext: sc({ characterName: 'Stary Kronikarz', locationIntro: 'Park nad rzeką — ulubione miejsce Bielickiego.', taskNarrative: 'Siódmy fragment to sam szyfr.', clueRevealed: 'Z wysokości wszystko się objawia' }),
            hints: { create: [
              { orderIndex: 0, content: 'Weź pierwsze litery każdej z 6 dotychczasowych wskazówek', pointPenalty: 20 },
              { orderIndex: 1, content: 'Odpowiedź to nazwa rzeki przepływającej przez Strzyżów', pointPenalty: 40 },
            ] },
          },
          {
            title: 'Objawienie kronikarza', description: 'Co kronikarz odkrył o Strzyżowie? Odpowiedz na wielką zagadkę.',
            type: TaskType.TEXT_AI, unlockMethod: UnlockMethod.GPS, orderIndex: 7,
            latitude: 49.8807, longitude: 21.8021,
            unlockConfig: { radiusMeters: 150, targetLat: 49.8807, targetLng: 21.8021 },
            verifyConfig: {
              prompt: 'Gracz odpowiada na finalne pytanie gry narracyjnej. Oceń na 0.7+ jeśli odpowiedź syntetyzuje wskazówki i nawiązuje do wielokulturowości / jedności / ukrytej prawdy.',
              threshold: 0.5, maxTokens: 1000,
            },
            maxPoints: 250, timeLimitSec: 600,
            storyContext: sc({ characterName: 'Stary Kronikarz', locationIntro: 'Ze wzgórza widzisz całe miasto.', taskNarrative: 'Ósmy fragment — Ty musisz napisać zakończenie.', clueRevealed: 'Rękopis jest kompletny. Prawda o Strzyżowie żyje dalej.' }),
            hints: { create: [
              { orderIndex: 0, content: 'Pomyśl o tym, co łączy wszystkie odwiedzone miejsca', pointPenalty: 25 },
              { orderIndex: 1, content: 'Kronikarz żył w czasach rozbiorów. Dlaczego jedność mogła być niebezpieczna?', pointPenalty: 40 },
            ] },
          },
        ],
      },
    },
    include: { tasks: { orderBy: { orderIndex: 'asc' } } },
  });

  console.log(`Game "${narrativeGame.title}" created with ${narrativeGame.tasks.length} tasks.`);
  return narrativeGame;
}
