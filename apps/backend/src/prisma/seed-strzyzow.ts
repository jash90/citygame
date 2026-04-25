import { PrismaClient, GameStatus, TaskType, UnlockMethod } from '@prisma/client';
import { buildAnswerHashes } from '../common/utils/offline-hash';
import { cleanGames } from './seed-utils';

/**
 * "Tajemnice Strzyżowa" — przebudowane wokół polskich motywów literackich.
 *
 * Motyw przewodni: *mała ojczyzna jako mikrokosmos dziejów* (rozdz. 6.1 i 9.2
 * kompendium). Gracz nie zwiedza miasteczka z przewodnika — czyta je jak
 * warstwową księgę, w której każde miejsce odpowiada innemu motywowi polskiej
 * tradycji: niepodległość, Matka-Ojczyzna, szlachta i dworek, pogranicze
 * kultur, cena wolności, diaspora, powrót do źródeł.
 *
 * Każde zadanie ma w `storyContext.clueRevealed` wskazówkę prowadzącą wprost
 * do KOLEJNEJ lokalizacji — tak jak w szkolnej grze terenowej, gdzie hasło
 * odkryte w punkcie N kieruje do punktu N+1.
 */
export async function seedStrzyzowGame(
  prisma: PrismaClient,
  adminId: string,
) {
  await cleanGames(prisma, ['Tajemnice Strzyżowa']);

  const sc = (ctx: Record<string, string>): string => JSON.stringify(ctx);

  const [wislokHashes, synagogaHashes] = await Promise.all([
    buildAnswerHashes('wisłok'),
    buildAnswerHashes('synagoga'),
  ]);

  const strzyzowGame = await prisma.game.create({
    data: {
      title: 'Tajemnice Strzyżowa',
      description:
        'Mała ojczyzna jako mikrokosmos polskich losów. Przejdź szlakiem ośmiu miejsc Strzyżowa i odkryj, jak w jednym miasteczku zapisała się historia całego narodu — od powstań, przez wielokulturowe dziedzictwo, po powrót do źródeł.',
      city: 'Strzyżów',
      status: GameStatus.PUBLISHED,
      settings: {
        maxPlayers: 100,
        allowHints: true,
        timeLimitMinutes: 150,
        narrative: {
          isNarrative: true,
          theme: 'Mała ojczyzna',
          prologue:
            'Wracasz do Strzyżowa po latach. Miasteczko twoich przodków jest małe, ale niesie w sobie wszystkie warstwy polskich dziejów — niepodległość, wiarę, szlachtę, pogranicze kultur, cenę wolności, diasporę.\n\nOsiem miejsc. Każde opowiada jeden wątek. Każde zostawia wskazówkę do następnego.\n\nPrzejdź ten szlak i zobacz, czy "mała ojczyzna" jest dla ciebie jeszcze czymś więcej niż słowem w piosence.',
          epilogue:
            'Przeszedłeś całe miasteczko. Od pomnika wolności, przez świątynię Matki-Ojczyzny, dwór szlachecki, rzekę, która zamiast dzielić — łączyła, cmentarz cena-wolności, ślad po zaginionej gminie żydowskiej, aż po wzgórze, z którego widać wszystko.\n\nStrzyżów to nie jest stolica i nigdy nie będzie. Ale w ośmiu jego miejscach zapisała się cała Polska — ta z hymnu, ta z powieści, ta z rodzinnych opowieści. Mała ojczyzna to nie miejsce na mapie. To sposób, w jaki dziedziczysz pamięć.',
        },
      },
      creatorId: adminId,
      tasks: {
        create: [
          // ── 1. NIEPODLEGŁOŚĆ ────────────────────────────────────────────
          {
            title: 'Pomnik Niepodległości',
            description:
              '"Jeszcze Polska nie zginęła..." — stań u stóp pomnika, który upamiętnia rok 1918 i odzyskanie niepodległości po 123 latach zaborów.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 0,
            latitude: 49.8685,
            longitude: 21.7877,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8685, targetLng: 21.7877 },
            verifyConfig: { targetLat: 49.8685, targetLng: 21.7877, radiusMeters: 30 },
            maxPoints: 60,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Głos pamięci',
              locationIntro:
                'Strzyżowski Rynek. Pomnik stoi tu nie dla zwycięzców — dla tych, którzy przez 123 lata rozbiorów wierzyli, że Polska jeszcze jest, bo oni jeszcze są.',
              taskNarrative:
                'Podejdź pod pomnik. Zatrzymaj się na chwilę. "Naród bez państwa" to nie metafora — to stan, z którego przodkowie tego miasteczka wyszli w 1918 roku.',
              clueRevealed:
                'Niepodległość nie wzięła się z pomnika — wzięła się z modlitwy. Idź do świątyni na południe od Rynku, gdzie dzwony biły za każdego, kto padał za nią. To kolejny przystanek.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Pomnik stoi w samym sercu Rynku — nie pomylisz.', pointPenalty: 10 },
              ],
            },
          },

          // ── 2. MATKA-OJCZYZNA ────────────────────────────────────────────
          {
            title: 'Kościół Niepokalanego Poczęcia NMP',
            description:
              'W polskiej tradycji literackiej ojczyzna jest Matką — i często nakłada się na figurę Matki Boskiej. Zrób zdjęcie fasady kościoła parafialnego: barokowej, z wieżą, która od XVIII wieku wyznacza centrum duchowe miasteczka.',
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
            storyContext: sc({
              characterName: 'Głos pamięci',
              locationIntro:
                'Kościół Niepokalanego Poczęcia NMP — wieża góruje nad miasteczkiem od dwóch wieków. Sakralizacja ojczyzny to nie mit — to język, którym ludzie tego miejsca mówili o sobie.',
              taskNarrative:
                'Utrwal tę fasadę. Zwróć uwagę na wieżę i barokowe zdobienia. W polskiej literaturze Matka-Ojczyzna ma właśnie takie rysy: surowe, wysokie, wzywające.',
              clueRevealed:
                'Pod wieżą modliła się cała wspólnota — ale władza nad ziemią należała do panów szlacheckich. Aby ich znaleźć, idź na północny-zachód, do ich dworu pod lasem. Tam dalej.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Kościół znajduje się przy południowej stronie Rynku', pointPenalty: 10 },
                { orderIndex: 1, content: 'Szukaj budynku z charakterystyczną wieżą kościelną', pointPenalty: 20 },
              ],
            },
          },

          // ── 3. POLSKA SZLACHECKA ─────────────────────────────────────────
          {
            title: 'Zespół dworski Wołkowickich',
            description:
              'Przed tobą klasyczny polski dworek — symbol Polski szlacheckiej z "Pana Tadeusza" i "Nad Niemnem". Odpowiedz: jaką rolę pełnił taki dwór w życiu małego miasteczka w XVIII i XIX wieku? (administracja, kultura, gospodarka — wybierz własnymi słowami).',
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
            storyContext: sc({
              characterName: 'Głos pamięci',
              locationIntro:
                'Dwór Wołkowickich. Tu ważyły się losy okolicznych wsi. Polska szlachecka z literatury to nie tylko mit sielanki — to też zacofanie i nadużycia wobec chłopów. Dworek jest piękny, ale nie naiwny.',
              taskNarrative:
                'Spróbuj opisać własnymi słowami, czym był taki dwór dla miasteczka. Nie szukaj jednej odpowiedzi — szlachta pełniła wiele ról naraz.',
              clueRevealed:
                'Panowie sądzili, zarządzali, wydawali biesiady — ale życie miasteczka toczyło się nie na salonie, tylko nad rzeką. Zejdź na południe, nad Wisłok. Nad brzegiem jest park — tam kolejny ślad.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Pomyśl o funkcjach: administracja, kultura, gospodarka', pointPenalty: 15 },
              ],
            },
          },

          // ── 4. POGRANICZE KULTUR / WISŁOK ───────────────────────────────
          {
            title: 'Park Miejski nad rzeką',
            description:
              'W polskiej literaturze rzeka rzadko dzieli — częściej łączy. Zrób zdjęcie alejki parkowej lub mostku w parku miejskim nad Wisłokiem.',
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
            storyContext: sc({
              characterName: 'Głos pamięci',
              locationIntro:
                'Park nad Wisłokiem. Tu spotykali się wszyscy — szlachta, mieszczanie, chłopi, Żydzi. Rzeka była arterią, nie barierą. W narracji o "pograniczu kultur" to właśnie tędy wchodziły idee i wyroby ze wschodu na zachód.',
              taskNarrative:
                'Zrób zdjęcie, które pokaże tę rolę — zieleń, alejkę, ludzi, most. Niech kadr opowie, że to było miejsce przepływu, nie odgrodzenia.',
              clueRevealed:
                'Rzeka łączy — ale ma swoje imię. Przejdź kilkaset metrów na północny-zachód, na most w śródmieściu. Tam zadasz jej jedno pytanie i poznasz jedno słowo.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Szukaj zielonego terenu z alejkami nad rzeką', pointPenalty: 10 },
                { orderIndex: 1, content: 'Skieruj się w stronę rzeki, na południe od Rynku', pointPenalty: 20 },
              ],
            },
          },

          // ── 5. MOTYW PRZEJŚCIA — HASŁO OTWIERAJĄCE DRUGĄ POŁOWĘ GRY ─────
          {
            title: 'Zagadka na moście',
            description:
              'Stoisz na moście. W polskiej literaturze most jest motywem przejścia — między światami, między epokami, między "my" a "oni". Podaj nazwę rzeki, którą teraz przekraczasz. Małymi literami, z polskimi znakami.',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 4,
            latitude: 49.8672,
            longitude: 21.7926,
            unlockConfig: { radiusMeters: 70, targetLat: 49.8672, targetLng: 21.7926 },
            verifyConfig: { ...wislokHashes },
            maxPoints: 70,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Głos pamięci',
              locationIntro:
                'Most to zawsze próg. Za nim zaczyna się druga połowa tej podróży — już nie o tym, co piękne, lecz o tym, co płacono, żeby ta mała ojczyzna przetrwała.',
              taskNarrative:
                'Odpowiedź to siedem liter. Brzmi jak szum wody po kamieniach. Dopływ Sanu. Kiedy ją wpiszesz, ten most stanie się progiem także dla ciebie.',
              clueRevealed:
                'Przekroczyłeś rzekę — teraz przekroczysz coś trudniejszego: próg pamięci wojennej. Idź na północny-wschód od centrum, na cmentarz, gdzie leżą żołnierze frontu galicyjskiego. Cena wolności to kolejny przystanek.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Ta rzeka jest dopływem Sanu', pointPenalty: 10 },
                { orderIndex: 1, content: 'Siedem liter, zaczyna się na "w"', pointPenalty: 15 },
              ],
            },
          },

          // ── 6. CENA WOLNOŚCI ─────────────────────────────────────────────
          {
            title: 'Cmentarz Wojenny z I Wojny Światowej',
            description:
              'Polski motyw ceny wolności — cmentarze po powstaniach, wojnach, frontach. Zrób zdjęcie nagrobka lub pomnika centralnego tego cmentarza z I wojny światowej.',
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
            storyContext: sc({
              characterName: 'Głos pamięci',
              locationIntro:
                'Cmentarz wojenny z 1915 roku. Tu leżą żołnierze z kilku armii — wielu z nich nie wiedziało, w czyjej wojnie giną. Polski motyw "cena wolności" rzadko jest czysty: często oznacza, że ktoś inny zapłacił za twoje państwo.',
              taskNarrative:
                'Zrób zdjęcie tego miejsca z szacunkiem. Nie musi być efektowne — ma być uczciwe. Pamięć nie lubi filtrów.',
              clueRevealed:
                'Modlili się tu pod krzyżem. Ale niedaleko stał budynek, w którym modlono się inaczej — po hebrajsku. Wróć w stronę centrum, szukaj śladu wielokulturowego dziedzictwa Strzyżowa. Jedno słowo otworzy następne drzwi.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Cmentarz znajduje się na północny wschód od centrum miasta', pointPenalty: 15 },
                { orderIndex: 1, content: 'Szukaj miejsca z wojskowymi nagrobkami i krzyżami', pointPenalty: 25 },
              ],
            },
          },

          // ── 7. WIELOKULTUROWOŚĆ / DIASPORA ──────────────────────────────
          {
            title: 'Wielokulturowe dziedzictwo',
            description:
              'Przed tobą budynek — jedno ze świadectw wielokulturowej przeszłości Strzyżowa. Przed Zagładą żyła tu liczna społeczność żydowska. Jak nazywa się typ świątyni, w której modlili się wyznawcy judaizmu? Jedno słowo, małymi literami.',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 6,
            latitude: 49.8693,
            longitude: 21.7866,
            unlockConfig: { radiusMeters: 60, targetLat: 49.8693, targetLng: 21.7866 },
            verifyConfig: { ...synagogaHashes },
            maxPoints: 80,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Głos pamięci',
              locationIntro:
                'To miejsce było przez wieki drugim, równoległym sercem miasteczka. Motyw diaspory w polskiej literaturze ma dwie strony: tych, którzy wyjechali, i tych, którzy zniknęli. Tu dotykasz drugiej.',
              taskNarrative:
                'Słowo, którego szukasz, pochodzi z greki i oznacza "zgromadzenie". Bez niego mała ojczyzna Strzyżowa byłaby niekompletna — tak jak jest dziś.',
              clueRevealed:
                'Zebrałeś siedem warstw: wolność, wiarę, szlachtę, rzekę, przejście, cenę krwi, diasporę. Została jedna — spojrzenie z góry. Wejdź na wzgórze na północ od miasta. Stamtąd zobaczysz wszystko, przez co przeszedłeś, w jednym kadrze.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Odpowiedź to nazwa tego typu budynku sakralnego', pointPenalty: 10 },
                { orderIndex: 1, content: 'Nazwa pochodzi od greckiego słowa "zgromadzenie"', pointPenalty: 15 },
              ],
            },
          },

          // ── 8. POWRÓT DO ŹRÓDEŁ / PANORAMA ──────────────────────────────
          {
            title: 'Wzgórza Strzyżowskie — Panorama',
            description:
              'Na koniec wejdź na jedno ze wzgórz otaczających Strzyżów. Zrób zdjęcie panoramy miasteczka. W polskiej literaturze ostatnie spojrzenie z góry to motyw "powrotu do źródeł" — kiedy widzisz całość, zaczynasz rozumieć, co niesie to jedno małe miejsce.',
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
            storyContext: sc({
              characterName: 'Głos pamięci',
              locationIntro:
                'Widok stąd obejmuje wszystko, przez co przeszedłeś: pomnik, wieżę kościoła, dach dworu, wstęgę Wisłoka, most, cmentarz, miejsce, gdzie była synagoga. Jeden kadr.',
              taskNarrative:
                'Zrób panoramiczne zdjęcie. Niech będzie twoim kadrem "małej ojczyzny" — nie z przewodnika, tylko twoim własnym.',
              clueRevealed:
                'To już nie jest wskazówka do kolejnego miejsca. To pointa: Strzyżów nie jest stolicą i nigdy nie będzie. Ale w jego ośmiu miejscach mieści się cała Polska z hymnu, z powieści, z rodzinnych opowieści. Mała ojczyzna to nie miejsce — to sposób dziedziczenia pamięci.',
            }),
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
