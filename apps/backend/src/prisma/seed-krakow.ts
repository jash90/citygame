import { PrismaClient, GameStatus, TaskType, UnlockMethod } from '@prisma/client';
import { buildAnswerHashes } from '../common/utils/offline-hash';
import { cleanGames } from './seed-utils';

const sc = (ctx: Record<string, string>): string => JSON.stringify(ctx);

/**
 * "Śladami Historii Krakowa" — przebudowane wokół polskich motywów literackich.
 *
 * Motyw przewodni: *Kraków jako duchowa stolica narodu* — wędrówka przez osiem
 * miejsc, z których każde odpowiada innemu wątkowi polskiej tradycji:
 * mit założycielski, symbole narodowe, mieszczańska Polska, pamięć obrony,
 * twierdza narodu, praca u podstaw, diaspora, powstanie.
 *
 * Każde zadanie zostawia w `storyContext.clueRevealed` wskazówkę prowadzącą
 * wprost do KOLEJNEJ lokalizacji — po krakowsku: "od smoka po kopiec".
 */
export async function seedKrakowGame(
  prisma: PrismaClient,
  adminId: string,
  _janId: string,
  _annaId: string,
  _marekId: string,
) {
  await cleanGames(prisma, ['Śladami Historii Krakowa']);

  const [zygmuntHashes, zapiekankaHashes] = await Promise.all([
    buildAnswerHashes('zygmunt'),
    buildAnswerHashes('zapiekanka'),
  ]);

  const game = await prisma.game.create({
    data: {
      title: 'Śladami Historii Krakowa',
      description:
        'Kraków jako duchowa stolica Polski — osiem miejsc, osiem motywów polskiej literatury: od mitu smoka, przez dzwon Zygmunta, po kopiec Kościuszki. Każde zadanie zostawia wskazówkę do następnego.',
      city: 'Kraków',
      status: GameStatus.PUBLISHED,
      settings: {
        maxPlayers: 200,
        allowHints: true,
        timeLimitMinutes: 180,
        narrative: {
          isNarrative: true,
          theme: 'Duchowa stolica narodu',
          prologue:
            'Kraków nie był przez większość historii stolicą polityczną, ale pozostał stolicą duchową. W okresie zaborów i wojen to właśnie on dźwigał pamięć narodu: katedra z królewskimi grobami, kopiec Kościuszki, mury Collegium, Kazimierz z wielokulturową historią.\n\nDzisiejsza wyprawa to nie zwiedzanie pomników — to czytanie miasta jako tekstu. Osiem punktów, osiem motywów polskiej literatury. Każde miejsce zostawi ci jedną wskazówkę: gdzie dalej i dlaczego tam.\n\nZaczynamy tam, gdzie zaczyna się każda opowieść o Polsce — od mitu.',
          epilogue:
            'Przeszedłeś Kraków nie jako turysta, a jako czytelnik. Smok — mit założycielski. Zygmunt — symbol narodu. Sukiennice — miejska Polska. Hejnał — cena obrony. Barbakan — mury ducha. Collegium — praca u podstaw. Kazimierz — diaspora. Kopiec — powstanie.\n\nTe osiem motywów wraca w polskiej literaturze od Długosza po dzisiejszych poetów. Kraków ich nie wymyślił — ale ich nie zapomniał, nawet wtedy, kiedy państwa nie było. W tym sensie jest stolicą.',
        },
      },
      creatorId: adminId,
      tasks: {
        create: [
          // ── 0. MIT ZAŁOŻYCIELSKI — Smok Wawelski ─────────────────────────
          {
            title: 'Smok Wawelski',
            description:
              'Każda literatura zaczyna się od mitu założycielskiego. Krakowski smok to polska odpowiedź na tego typu motyw — pokonany przez sprytnego szewczyka Skubę, który ratuje miasto bez szlacheckiego miecza. Zeskanuj kod QR przy jaskini smoka u podnóża Wawelu.',
            type: TaskType.QR_SCAN,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 0,
            latitude: 50.054,
            longitude: 19.9352,
            unlockConfig: { radiusMeters: 80, targetLat: 50.054, targetLng: 19.9352 },
            verifyConfig: { expectedHash: 'sha256:smok_wawelski_2024' },
            maxPoints: 100,
            timeLimitSec: 600,
            storyContext: sc({
              characterName: 'Głos kroniki',
              locationIntro:
                'Jaskinia pod Wawelem. Mit mówi: smok terroryzował miasto, szlachta nie dała rady, dopiero chłop-szewczyk go pokonał. Literatura polska lubi tę wersję — w niej naród ratuje się sam.',
              taskNarrative:
                'Zeskanuj kod przy jaskini. W tym micie bierze początek wszystko, co Kraków znaczył dla Polski: że potrafi zacząć od nowa, nawet jeśli oficjalna władza zawodzi.',
              clueRevealed:
                'Wyjdź z jaskini i wejdź na wzgórze. Na Wawelu czeka największy symbol narodowy — dzwon, którego bicie słyszano za każdym koronacją i każdą żałobą. Jego imię to kolejne zadanie.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Szukaj przy jaskini smoka', pointPenalty: 10 },
                { orderIndex: 1, content: 'Pod Wawelem, nad Wisłą', pointPenalty: 20 },
              ],
            },
          },

          // ── 1. SYMBOL NARODOWY — Dzwon Zygmunt ──────────────────────────
          {
            title: 'Tajemnica katedry wawelskiej',
            description:
              'Symbole narodowe — w polskiej tradycji literackiej pojawiają się obok orła i hymnu. Stojąc przed katedrą wawelską, odpowiedz: jak nazywa się największy dzwon w Polsce, wiszący na wieży katedry? Wpisz samo imię (małymi literami).',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 1,
            latitude: 50.0543,
            longitude: 19.9356,
            unlockConfig: { radiusMeters: 60, targetLat: 50.0543, targetLng: 19.9356 },
            verifyConfig: { ...zygmuntHashes },
            maxPoints: 80,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Głos kroniki',
              locationIntro:
                'Katedra wawelska to grób królów i wielkich Polaków — Sienkiewicza, Mickiewicza, Słowackiego, Piłsudskiego. Dzwon, którego szukasz, bił przy każdej z tych ceremonii. Symbol narodu, który przetrwał wszystkie zabory.',
              taskNarrative:
                'Odpowiedź to imię króla, który ufundował dzwon w 1520. Wpisane małymi literami otwiera następne drzwi.',
              clueRevealed:
                'Zejdź z Wzgórza Wawelskiego i idź na północ — na Rynek Główny. Tam, pośrodku placu, stoi mieszczański symbol Polski: długa hala kupiecka z renesansową attyką. Zrób jej zdjęcie.',
            }),
          },

          // ── 2. MIESZCZAŃSKA POLSKA — Sukiennice ─────────────────────────
          {
            title: 'Sukiennice — Zrób zdjęcie',
            description:
              'Polska nie była tylko szlachecka. Mieszczaństwo — zwłaszcza krakowskie — trzymało kulturę i handel w czasach, gdy szlachta się rozpadała. Zrób zdjęcie Sukiennic z widoczną charakterystyczną renesansową attyką.',
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
            storyContext: sc({
              characterName: 'Głos kroniki',
              locationIntro:
                'Sukiennice — renesansowy budynek kupiecki z XVI wieku. W literaturze rzadko dostają tyle uwagi co dworek czy katedra, ale to one opowiadają o Polsce miejskiej: praktycznej, wielojęzycznej, otwartej na obcych.',
              taskNarrative:
                'Zrób zdjęcie attyki — to charakterystyczny renesansowy element, wieńczący budynek ozdobnymi sterczynami. Kadr ma pokazać, że mieszczaństwo potrafiło mieć własny styl.',
              clueRevealed:
                'Na tym samym Rynku, kilka kroków na północny-wschód od Sukiennic, wznosi się kościół z dwiema wieżami. Z jednej z nich co godzinę rozlega się melodia, która urywa się nagle. Idź tam — i wyjaśnij dlaczego.',
            }),
          },

          // ── 3. PAMIĘĆ OBRONY — Hejnał ──────────────────────────────────
          {
            title: 'Kościół Mariacki — Hejnał',
            description:
              'Motyw "ceny obrony" w polskiej literaturze. Hejnał mariacki co godzinę urywa się w połowie melodii — jest to wbudowane w rytuał samego miasta upamiętnienie. Stojąc przy kościele Mariackim, napisz: dlaczego hejnał urywa się?',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.QR,
            orderIndex: 3,
            latitude: 50.0617,
            longitude: 19.9394,
            unlockConfig: { qrCode: 'KOSCIOL_MARIACKI_HEJNAL' },
            verifyConfig: {
              prompt:
                'Oceń odpowiedź: dlaczego hejnał mariacki urywa się w połowie? Poprawna odpowiedź powinna wspomnieć o tatarskim łuczniku, który zastrzelił trębacza podczas najazdu.',
              threshold: 0.65,
            },
            maxPoints: 120,
            timeLimitSec: 300,
            storyContext: sc({
              characterName: 'Głos kroniki',
              locationIntro:
                'Kościół Mariacki. Legenda mówi: w 1241 roku, podczas najazdu tatarskiego, trębacz alarmował miasto z wieży, dopóki tatarska strzała nie zabiła go w połowie melodii. Miasto pamięta o nim do dziś — przez ciszę w środku hejnału.',
              taskNarrative:
                'Napisz, dlaczego hejnał urywa się. Odpowiedź nie musi być długa — ważne, żeby zawierała historię trębacza i tego, że to rytuał pamięci.',
              clueRevealed:
                'Trębacz ginął, żeby miasto zdążyło się obronić. Obronę Krakowa wspierały mury — potężny barbakan na północy. Kieruj się ulicą Floriańską, wyjdź bramą na północ i znajdź gotycką fortecę, która stała na drodze najeźdźcom.',
            }),
          },

          // ── 4. TWIERDZA NARODU — Barbakan ───────────────────────────────
          {
            title: 'Barbakan',
            description:
              'Barbakan — gotycka forteca z końca XV wieku, broniąca głównej bramy Krakowa. Motyw "murów ducha" w polskiej literaturze: kiedy państwo słabnie, pamięć o murach, które kiedyś broniły, sama staje się murem. Podejdź pod barbakan, system zweryfikuje twoje położenie.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 4,
            latitude: 50.0653,
            longitude: 19.9418,
            unlockConfig: { radiusMeters: 80, targetLat: 50.0653, targetLng: 19.9418 },
            verifyConfig: { targetLat: 50.0653, targetLng: 19.9418, radiusMeters: 30 },
            maxPoints: 60,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Głos kroniki',
              locationIntro:
                'Barbakan. Okrągły, potężny, z siedmioma wieżyczkami. Nie zdobyto go nigdy — a kiedy zaborcy rozbierali mury miasta, ten fragment zostawili. Bo już nie o mury chodziło, a o to, co one znaczyły.',
              taskNarrative:
                'Stań pod murami. Nie musisz nic robić poza tym — sama bliskość jest zadaniem. Literatura polska wielokrotnie wracała do motywu twierdzy, która nie poddała się, nawet kiedy wszystko wokół się waliło.',
              clueRevealed:
                'Naród, który stracił państwo, budował coś innego zamiast twierdzy: uniwersytet. Kilka ulic na zachód stąd stoi Collegium Maius — najstarszy budynek Uniwersytetu Jagiellońskiego. Tam praca u podstaw zaczynała się wcześniej, niż wymyślono tę nazwę.',
            }),
          },

          // ── 5. PRACA U PODSTAW — Collegium Maius ────────────────────────
          {
            title: 'Collegium Maius',
            description:
              '"Praca u podstaw" — motyw pozytywistyczny w polskiej literaturze — miała w Krakowie korzenie jeszcze średniowieczne. Collegium Maius, założone w 1400 roku, uczyło tu Kopernika, w XIX wieku — kolejne pokolenia pozbawione własnego państwa. Zeskanuj kod QR przy bramie.',
            type: TaskType.QR_SCAN,
            unlockMethod: UnlockMethod.QR,
            orderIndex: 5,
            latitude: 50.0618,
            longitude: 19.9332,
            unlockConfig: { qrCode: 'COLLEGIUM_MAIUS_BRAMA' },
            verifyConfig: { expectedHash: 'sha256:collegium_maius_2024' },
            maxPoints: 90,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Głos kroniki',
              locationIntro:
                'Collegium Maius — gotyckie wnętrza, arkady, zegar słoneczny na dziedzińcu. To jedno z najstarszych miejsc edukacji w Europie Środkowej. Dla Polski w okresie zaborów uniwersytet w Krakowie był schronieniem, gdzie można było uczyć po polsku, kiedy gdzie indziej nie było wolno.',
              taskNarrative:
                'Zeskanuj kod przy bramie. Edukacja jako forma oporu — to też jest motyw literacki, chociaż rzadziej kojarzony niż walka zbrojna.',
              clueRevealed:
                'Opuść dziedziniec Collegium i skieruj się na południowy-wschód, poza Stare Miasto, do Kazimierza. Tam, na Placu Nowym, przez wieki tętniła żydowska społeczność Krakowa — jej echa wciąż czuć w ulicznym jedzeniu. Jedno słowo cię tam wpuści.',
            }),
          },

          // ── 6. DIASPORA / WIELOKULTUROWOŚĆ — Kazimierz ──────────────────
          {
            title: 'Kazimierz — Plac Nowy',
            description:
              'Kazimierz przez pięć wieków był osobnym miastem wyznań żydowskich. Motyw diaspory w polskiej literaturze — "ci, którzy byli" — ma tu swoją konkretną mapę. Jak nazywa się kultowe krakowskie danie serwowane na Placu Nowym przez całą dobę? Jedno słowo, małymi literami.',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 6,
            latitude: 50.051,
            longitude: 19.9455,
            unlockConfig: { radiusMeters: 70, targetLat: 50.051, targetLng: 19.9455 },
            verifyConfig: { ...zapiekankaHashes },
            maxPoints: 70,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Głos kroniki',
              locationIntro:
                'Plac Nowy, dawniej Żydowski. Okrągły budynek pośrodku — dawna rzeźnia koszerna, dziś kultowy "okrąglak" z żarciem. Pod Zagładą mieszkało tu jedno z najważniejszych skupisk kultury jidysz w Europie. Dziś zostały nazwy ulic i pewne smaki.',
              taskNarrative:
                'Odpowiedź to nazwa dania, które stało się symbolem Kazimierza lat 90. — prosta bułka z pieczarkami i serem, długa jak pamięć. Wpisz małymi literami.',
              clueRevealed:
                'Zjadłeś Kazimierz. Teraz wspomnij tych, którzy nie dla wszystkich byli symbolem narodu — dla niektórych byli buntownikami. Na wzgórzu na zachód od Starego Miasta usypano kopiec ku jego czci. Zrób mu zdjęcie z daleka — widok sam w sobie jest już motywem.',
            }),
          },

          // ── 7. POWSTANIE / FINAŁ — Kopiec Kościuszki ────────────────────
          {
            title: 'Kopiec Kościuszki',
            description:
              'Motyw "walki o niepodległość" w polskiej literaturze ma tu swoją ziemną reprezentację: kopiec usypany z ziemi z pól bitewnych, gdzie walczył Kościuszko — od Racławic po Amerykę. Zrób zdjęcie kopca widocznego z Krakowa.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 7,
            latitude: 50.0545,
            longitude: 19.8932,
            unlockConfig: { radiusMeters: 150, targetLat: 50.0545, targetLng: 19.8932 },
            verifyConfig: {
              prompt: 'Oceń czy zdjęcie przedstawia Kopiec Kościuszki w Krakowie, widoczny na wzgórzu.',
              threshold: 0.6,
            },
            maxPoints: 200,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Głos kroniki',
              locationIntro:
                'Kopiec Kościuszki — usypany ręcznie w latach 1820–1823, w ziemię z pól bitewnych Insurekcji Kościuszkowskiej i wojen napoleońskich. Motyw powstania w literaturze polskiej przybiera tu najbardziej dosłowną formę: wzgórze z pamięci.',
              taskNarrative:
                'Zrób zdjęcie kopca z perspektywy, z której widzisz całe wzgórze. Nie musi być z bliska — ten motyw działa lepiej z dystansu.',
              clueRevealed:
                'To już ostatnie zadanie. Przeszedłeś osiem miejsc: mit, symbol, mieszczaństwo, pamięć obrony, mury, uniwersytet, diaspora, powstanie. W polskiej literaturze wszystkie te motywy kumulują się w Krakowie. Ale dopiero ty, przechodząc je nogami, zamieniłeś je z pomników w opowieść.',
            }),
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
