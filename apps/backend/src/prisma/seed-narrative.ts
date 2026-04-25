import { PrismaClient, GameStatus, TaskType, UnlockMethod } from '@prisma/client';
import { buildAnswerHashes } from '../common/utils/offline-hash';
import { cleanGames } from './seed-utils';

const sc = (ctx: Record<string, string>): string => JSON.stringify(ctx);

/**
 * "Zagubiony Rękopis Kronikarza" — odświeżone wokół silnika "Naród bez państwa"
 * (rozdz. 9.1 kompendium).
 *
 * Rok 1782 — 10 lat po I rozbiorze, 11 lat przed II. Kronikarz Maciej Bielicki
 * wie, że Rzeczpospolita się rozpada, i ukrywa w Strzyżowie rękopis: siedem
 * fragmentów o wielokulturowej jedności miasteczka, które pod obcą władzą mogły
 * zostać wyparte. Ósmy fragment — finalną odpowiedź — musi dopisać sam gracz.
 *
 * Każde zadanie zostawia w `storyContext.clueRevealed` wskazówkę prowadzącą
 * do KOLEJNEJ lokalizacji. Pierwsze litery wskazówek z zadań 0–5 (w kolejności
 * W, I, S, Ł, O, K) składają się w hasło "WISŁOK" — to rozwiązanie szyfru
 * kronikarza (zadanie 6).
 */
export async function seedNarrativeGame(prisma: PrismaClient, adminId: string) {
  await cleanGames(prisma, ['Zagubiony Rękopis Kronikarza']);

  const [rekopisHashes] = await Promise.all([
    buildAnswerHashes('wisłok'),
  ]);

  const narrativeGame = await prisma.game.create({
    data: {
      title: 'Zagubiony Rękopis Kronikarza',
      description:
        'Rok 1782. Kronikarz Maciej Bielicki ukrył w Strzyżowie rękopis z prawdą, która po rozbiorach mogłaby zniknąć na zawsze. Idź po siedmiu śladach, złóż szyfr z pierwszych liter ich wskazówek i sam dopisz finał.',
      city: 'Strzyżów',
      status: GameStatus.PUBLISHED,
      settings: {
        maxPlayers: 100,
        allowHints: true,
        timeLimitMinutes: 180,
        narrative: {
          isNarrative: true,
          theme: 'Naród bez państwa',
          prologue:
            'Strzyżów, rok 1782. Polska chyli się ku upadkowi — dziesięć lat po I rozbiorze, w cieniu zbliżającego się drugiego.\n\nKronikarz Maciej Bielicki wie, że pod obcą władzą wiele rzeczy zostanie wypartych z pamięci: jedność wielu kultur, które tu żyły, zasługi chłopów i Żydów, prawda o tym, co robiła szlachta. Dzieli swój rękopis na osiem fragmentów i chowa je po całym miasteczku.\n\n"Kto zbierze wszystkie — pozna prawdziwą historię Strzyżowa. Niech szuka tam, gdzie bije serce miasta..."\n\nTwoje zadanie: zebrać siedem fragmentów, złożyć zaszyfrowane hasło z pierwszych liter wskazówek kronikarza i sam dopisać ósmy — bo finał tej opowieści musi napisać ktoś, kto dziś jeszcze pamięta.',
          epilogue:
            'Rękopis jest kompletny. Bielicki wiedział, że po rozbiorach wielokulturowa jedność Strzyżowa — Polaków, Żydów, chłopów, szlachty, wojskowych — zostanie przemilczana, bo dla zaborców była niewygodna. Ukrył ją w miejscach, które pod nową władzą zmieniły nazwy, ale zostały.\n\nTeraz ty jesteś kolejnym kronikarzem. Rozdzierasz na fragmenty to, co chcesz ocalić — i zostawiasz w miastach, w których ktoś jeszcze może chcieć zrozumieć.',
        },
      },
      creatorId: adminId,
      tasks: {
        create: [
          // ── 0. SERCE MIASTA — clue startuje na "W" ──────────────────────
          {
            title: 'Serce miasta',
            description:
              'Rynek Strzyżowa — od wieków centrum życia miasteczka. Stań na środku, pod pomnikiem. Tu Bielicki zaczął swoją kronikę.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 0,
            latitude: 49.8685,
            longitude: 21.7877,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8685, targetLng: 21.7877 },
            verifyConfig: { targetLat: 49.8685, targetLng: 21.7877, radiusMeters: 30 },
            maxPoints: 50,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Maciej Bielicki',
              locationIntro:
                '„Serce miasta bije tu, na Rynku — tak pisałem w 1782. Kiedy tych słów będziesz potrzebować, państwa już nie będzie."',
              taskNarrative:
                'Pierwszy fragment rękopisu zapisał kronikarz w centrum miasteczka. Naród nie ma jeszcze stolicy w Warszawie dla wszystkich — ma rynek w każdym małym mieście, i tego nie da się zabrać.',
              clueRevealed:
                'Wejdź w uliczkę prowadzącą na południe od Rynku. Tam wznosi się wieża, pod którą modlono się o przetrwanie narodu. Drugi fragment leży w kronice parafialnej.',
            }),
          },

          // ── 1. DUCHOWE CENTRUM — clue startuje na "I" ────────────────────
          {
            title: 'Duchowe centrum',
            description:
              'Kościół parafialny Niepokalanego Poczęcia NMP — od XVIII wieku wieża góruje nad Strzyżowem. Zrób zdjęcie fasady lub wieży.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 1,
            latitude: 49.8678,
            longitude: 21.7851,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8678, targetLng: 21.7851 },
            verifyConfig: {
              prompt: 'Oceń czy zdjęcie przedstawia kościół z wieżą i barokową fasadą.',
              threshold: 0.6,
            },
            maxPoints: 100,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Maciej Bielicki',
              locationIntro:
                '„Wieża kościoła widziana jest z każdego okna miasteczka. Pod obcą władzą też będzie widoczna — tylko nikt już nie powie, czyja jest."',
              taskNarrative:
                'Drugi fragment schowano w kronice parafialnej. Matka-Ojczyzna w literaturze ma zawsze rysy Matki Boskiej — i tu nie inaczej.',
              clueRevealed:
                'Idź na wschód, nad rzekę — do mostu, który łączy dwa brzegi miasteczka. Tam czeka trzeci fragment, pod kamieniem, o którym wiedzą tylko przemytnicy i rybacy.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Kościół stoi przy południowej stronie Rynku', pointPenalty: 10 },
              ],
            },
          },

          // ── 2. STRAŻNIK PRZEPRAWY — clue startuje na "S" ────────────────
          {
            title: 'Strażnik przeprawy',
            description:
              'Most na Wisłoku. Rzeka — w polskiej literaturze motyw przejścia. Podejdź pod sam most, wejdź w rolę strażnika przeprawy.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 2,
            latitude: 49.8672,
            longitude: 21.7926,
            unlockConfig: { radiusMeters: 70, targetLat: 49.8672, targetLng: 21.7926 },
            verifyConfig: { targetLat: 49.8672, targetLng: 21.7926, radiusMeters: 30 },
            maxPoints: 50,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Maciej Bielicki',
              locationIntro:
                '„Rzeka u nas nie dzieli. Chłopi, szlachta, kupcy, Żydzi — wszyscy przechodzą przez ten sam most. Pod obcą władzą most pozostanie, ale drogi staną się inne."',
              taskNarrative:
                'Trzeci fragment ukryłem pod kamieniem na przyczółku mostu. Naród bez państwa to nie naród bez rzek, dróg, mostów — to właśnie one go dźwigają, kiedy państwa brak.',
              clueRevealed:
                'Skieruj się na północny-wschód, za rogatki — tam leży cmentarz. Za każdym pokoleniem dorasta on o nowe rzędy. Czwarty fragment spoczywa wśród kamieni.',
            }),
          },

          // ── 3. PAMIĘĆ POKOLEŃ — clue startuje na "Ł" ────────────────────
          {
            title: 'Pamięć pokoleń',
            description:
              'Cmentarz wojenny z I wojny światowej. Motyw "cena wolności" w polskiej literaturze. Opisz własnymi słowami, co czujesz wśród tych nagrobków — czego ta pamięć od nas dziś wymaga.',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 3,
            latitude: 49.8722,
            longitude: 21.7833,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8722, targetLng: 21.7833 },
            verifyConfig: {
              prompt: 'Oceń czy odpowiedź jest refleksją na temat pamięci o poległych i ceny wolności.',
              threshold: 0.5,
            },
            maxPoints: 120,
            timeLimitSec: 300,
            storyContext: sc({
              characterName: 'Maciej Bielicki',
              locationIntro:
                '„Kiedy pisałem ten fragment, nie wiedziałem jeszcze, ilu będzie leżało w tej ziemi przez kolejne wieki. Ale wiedziałem, że będą."',
              taskNarrative:
                'Czwarty fragment znaleziono na jednym z nagrobków. Pamięć pokoleń to nie abstrakcja — to konkretne imiona, ułożone w rzędach.',
              clueRevealed:
                'Łaska pamięci należy się także tym, których świątynia zniknęła z miasta. Wróć bliżej centrum — tam, gdzie do wojny stała synagoga. Piąty fragment ma cień po niej.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Napisz o swoich osobistych uczuciach, nie recytuj faktów', pointPenalty: 15 },
              ],
            },
          },

          // ── 4. GŁOSY PRZESZŁOŚCI — clue startuje na "O" ─────────────────
          {
            title: 'Głosy przeszłości',
            description:
              'Tu, w centrum Strzyżowa, stała niegdyś synagoga. Motyw diaspory — "ci, którzy zniknęli" — w polskiej literaturze. Napisz, dlaczego pamięć o wielokulturowej przeszłości jest dziś ważna.',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 4,
            latitude: 49.8693,
            longitude: 21.7866,
            unlockConfig: { radiusMeters: 60, targetLat: 49.8693, targetLng: 21.7866 },
            verifyConfig: {
              prompt: 'Oceń czy odpowiedź zawiera refleksję na temat wielokulturowości i pamięci o społecznościach, których już nie ma.',
              threshold: 0.5,
            },
            maxPoints: 120,
            timeLimitSec: 300,
            storyContext: sc({
              characterName: 'Maciej Bielicki',
              locationIntro:
                '„Nie zapisałem wtedy jej adresu — bo wtedy była oczywista. Dziś trzeba pamiętać, że tu stała."',
              taskNarrative:
                'Piąty fragment przechował żydowski aptekarz — zostawił go w pustej ramie po zdjęciu rodziny, żeby ktoś kiedyś zapytał, kto na nim był.',
              clueRevealed:
                'Odwiedź teraz panów tego miasteczka. Ich dwór stoi na północny-zachód, pod lasem. Szósty fragment leży w bibliotece pałacu — w herbarzu, który milczy o połowie prawdy.',
            }),
          },

          // ── 5. SZLACHECKIE SEKRETY — clue startuje na "K" ───────────────
          {
            title: 'Szlacheckie sekrety',
            description:
              'Pałac Wołkowickich-Konopków. Polska szlachecka — motyw sielanki, ale też klasowych napięć. Zrób zdjęcie zabytkowej architektury dworu.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 5,
            latitude: 49.8731,
            longitude: 21.7698,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8731, targetLng: 21.7698 },
            verifyConfig: {
              prompt: 'Oceń czy zdjęcie przedstawia zabytkowy budynek o historycznej architekturze (dwór/pałac).',
              threshold: 0.55,
            },
            maxPoints: 100,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Maciej Bielicki',
              locationIntro:
                '„Byłem tu na biesiadach. Panowie znali kronikę, ale kazali z niej wycinać to, co ich nie chwaliło. Ja przechowałem oryginał."',
              taskNarrative:
                'Szósty fragment ukryto w bibliotece dworu — między kartami herbarza, tuż obok strony, którą Wołkowiccy chcieli zniszczyć.',
              clueRevealed:
                'Kiedy opuścisz dwór, zejdź na południe, nad rzekę — do parku, w którym kronikarz najchętniej pisał. Tam czeka ostatni kamień tej układanki: szyfr, który otworzy finał.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Szukaj budynku o historycznej architekturze przy ul. Sobieskiego', pointPenalty: 15 },
              ],
            },
          },

          // ── 6. SZYFR KRONIKARZA — CIPHER (odpowiedź: wisłok) ────────────
          {
            title: 'Szyfr kronikarza',
            description:
              'Park nad rzeką — ulubione miejsce Bielickiego. Pierwsze litery wskazówek z sześciu poprzednich zadań (po kolei: W, I, S, Ł, O, K) składają się w jedno słowo. Nazwa tej rzeki. Wpisz małymi literami, z polskimi znakami.',
            type: TaskType.CIPHER,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 6,
            latitude: 49.8644,
            longitude: 21.8005,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8644, targetLng: 21.8005 },
            verifyConfig: {
              ...rekopisHashes,
              cipherHint: 'Przeczytaj pierwsze litery każdej z sześciu wskazówek kronikarza — w tej kolejności, w jakiej pojawiały się w grze.',
            },
            maxPoints: 150,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Maciej Bielicki',
              locationIntro:
                '„Ten park będzie tu i wtedy, kiedy Rzeczpospolitej nie będzie. Drzewa pamiętają dłużej niż granice."',
              taskNarrative:
                'Siódmy fragment to sam szyfr — klucz, którym kronikarz zamknął rękopis. Pierwsze litery jego wskazówek tworzą imię tego, co przez miasteczko przepływa: źródła, które łączy.',
              clueRevealed:
                'Z wysokości wszystko się objawia. Wejdź na wzgórze na północny-wschód od miasta. Tam nie znajdziesz ósmego fragmentu — tam ty dopiszesz go sam.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Weź pierwsze litery każdej z 6 wskazówek, w kolejności pojawiania się', pointPenalty: 20 },
                { orderIndex: 1, content: 'Odpowiedź to nazwa rzeki przepływającej przez Strzyżów (7 liter)', pointPenalty: 40 },
              ],
            },
          },

          // ── 7. OBJAWIENIE — finał, gracz pisze ósmy fragment ────────────
          {
            title: 'Objawienie kronikarza',
            description:
              'Wzgórze nad Strzyżowem. Z tej wysokości widzisz wszystkie siedem miejsc, w których ukryto fragmenty rękopisu. Napisz ósmy — co Bielicki chciał, żeby zostało zapamiętane o Strzyżowie, kiedy państwa już nie będzie?',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 7,
            latitude: 49.8807,
            longitude: 21.8021,
            unlockConfig: { radiusMeters: 150, targetLat: 49.8807, targetLng: 21.8021 },
            verifyConfig: {
              prompt:
                'Gracz pisze finałowy fragment rękopisu kronikarza. Oceń na 0.7+ jeśli odpowiedź syntetyzuje wcześniejsze wskazówki, nawiązuje do wielokulturowej jedności miasteczka i rozumie kontekst "naród bez państwa" (rozbiory, zachowanie pamięci pod obcą władzą).',
              threshold: 0.5,
              maxTokens: 1000,
            },
            maxPoints: 250,
            timeLimitSec: 600,
            storyContext: sc({
              characterName: 'Maciej Bielicki',
              locationIntro:
                '„Ze wzgórza widać całe miasteczko w jednym kadrze. Rynek, kościół, most, cmentarz, miejsce po synagodze, dwór, park. Wszystko. To jest rękopis."',
              taskNarrative:
                'Ósmy fragment nie leży pod kamieniem. Nie zapisał go kronikarz. To ty go piszesz — dziś, z tego wzgórza. O tym, co łączy wszystkie miejsca, przez które przeszedłeś. O tym, co by zaginęło, gdyby nikt już nie szukał.',
              clueRevealed:
                'Rękopis jest kompletny. Bielicki zaszyfrował prawdę, bo pod zaborami była niebezpieczna. Ty nie musisz jej szyfrować — musisz tylko ją powtórzyć komuś innemu.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Pomyśl o tym, co łączy wszystkie odwiedzone miejsca', pointPenalty: 25 },
                { orderIndex: 1, content: 'Kronikarz żył w czasach rozbiorów — dlaczego prawda o jedności mogła być wtedy niebezpieczna?', pointPenalty: 40 },
              ],
            },
          },
        ],
      },
    },
    include: { tasks: { orderBy: { orderIndex: 'asc' } } },
  });

  console.log(`Game "${narrativeGame.title}" created with ${narrativeGame.tasks.length} tasks.`);
  return narrativeGame;
}
