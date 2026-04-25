import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { TaskType, haversineDistance } from '@citygame/shared';
import type { OfflineBundleTask } from '@/features/offline/types';

/**
 * Outcome of a local (offline) verification attempt. Mirrors the backend's
 * `VerificationResult` shape so the mutation queue can serialize the verdict
 * directly into the `submit` mutation payload.
 *
 * `PENDING` is mobile-specific: it means the task type cannot be verified
 * without the server (AI tasks). The submit goes onto the queue without a
 * local verdict and is reconciled after sync.
 */
export interface OfflineVerificationResult {
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'PENDING' | 'ERROR';
  score: number;
  feedback: string;
}

const sha256Hex = async (input: string): Promise<string> =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, input);

/**
 * Mirror of every backend strategy in
 * `apps/backend/src/modules/task/verification/strategies/`. Any change there
 * must be reflected here, or local + server verdicts will drift.
 */
export async function verifyOffline(
  task: OfflineBundleTask,
  submission: Record<string, unknown>,
): Promise<OfflineVerificationResult> {
  if (task.unsupportedOffline) {
    return {
      status: 'ERROR',
      score: 0,
      feedback: 'To zadanie nie zostało przygotowane do gry offline.',
    };
  }

  switch (task.type) {
    case TaskType.QR_SCAN:
      return verifyQrScan(task.verifyConfig, submission);
    case TaskType.GPS_REACH:
      return verifyGpsReach(task.verifyConfig, submission);
    case TaskType.TEXT_EXACT:
      return verifyTextHash(
        task.verifyConfig,
        submission,
        'Poprawna odpowiedź!',
        'Nieprawidłowa odpowiedź, spróbuj ponownie',
      );
    case TaskType.CIPHER:
      return verifyCipher(task.verifyConfig, submission);
    case TaskType.PHOTO_AI:
    case TaskType.AUDIO_AI:
    case TaskType.TEXT_AI:
      return {
        status: 'PENDING',
        score: 0,
        feedback: 'Zostanie zweryfikowane po połączeniu z internetem.',
      };
    case TaskType.MIXED:
      return verifyMixed(task.verifyConfig, submission);
    default:
      return { status: 'ERROR', score: 0, feedback: `Nieobsługiwany typ zadania: ${task.type}` };
  }
}

async function verifyQrScan(
  config: Record<string, unknown>,
  submission: Record<string, unknown>,
): Promise<OfflineVerificationResult> {
  const expectedHash = config.expectedHash as string | undefined;
  const code = (submission.code ?? submission.scannedCode) as string | undefined;
  if (!expectedHash || !code) {
    return { status: 'ERROR', score: 0, feedback: 'Brak kodu QR lub konfiguracji' };
  }
  const hex = await sha256Hex(code);
  const actual = `sha256:${hex}`;
  return actual === expectedHash
    ? { status: 'CORRECT', score: 1, feedback: 'Kod QR zweryfikowany!' }
    : { status: 'INCORRECT', score: 0, feedback: 'Kod QR nie pasuje' };
}

function verifyGpsReach(
  config: Record<string, unknown>,
  submission: Record<string, unknown>,
): OfflineVerificationResult {
  const targetLat = config.targetLat as number | undefined;
  const targetLng = config.targetLng as number | undefined;
  const radiusMeters = (config.radiusMeters as number | undefined) ?? 20;
  const playerLat = submission.latitude as number | undefined;
  const playerLng = submission.longitude as number | undefined;
  if (
    targetLat == null ||
    targetLng == null ||
    playerLat == null ||
    playerLng == null
  ) {
    return { status: 'ERROR', score: 0, feedback: 'Brak współrzędnych GPS' };
  }
  const distance = haversineDistance(playerLat, playerLng, targetLat, targetLng);
  if (distance <= radiusMeters) {
    return {
      status: 'CORRECT',
      score: 1,
      feedback: `Jesteś ${Math.round(distance)} m od celu — wystarczająco blisko.`,
    };
  }
  return {
    status: 'INCORRECT',
    score: 0,
    feedback: `Jesteś ${Math.round(distance)} m od celu — musisz być w promieniu ${radiusMeters} m.`,
  };
}

async function verifyTextHash(
  config: Record<string, unknown>,
  submission: Record<string, unknown>,
  okMsg: string,
  failMsg: string,
): Promise<OfflineVerificationResult> {
  const offlineHash = config.offlineHash as string | undefined;
  const offlineSalt = config.offlineSalt as string | undefined;
  const rawAnswer = submission.answer as string | undefined;
  if (!offlineHash || !offlineSalt || !rawAnswer) {
    return { status: 'ERROR', score: 0, feedback: 'Brak odpowiedzi lub konfiguracji' };
  }
  const normalized = rawAnswer.trim().toLowerCase();
  const actual = await sha256Hex(normalized + offlineSalt);
  return actual === offlineHash
    ? { status: 'CORRECT', score: 1, feedback: okMsg }
    : { status: 'INCORRECT', score: 0, feedback: failMsg };
}

async function verifyCipher(
  config: Record<string, unknown>,
  submission: Record<string, unknown>,
): Promise<OfflineVerificationResult> {
  const result = await verifyTextHash(
    config,
    submission,
    'Szyfr rozszyfrowany!',
    'Nieprawidłowa odpowiedź, spróbuj ponownie',
  );
  if (result.status === 'INCORRECT') {
    const hint = config.cipherHint as string | undefined;
    if (hint) {
      return { ...result, feedback: `Nieprawidłowa odpowiedź. Wskazówka: ${hint}` };
    }
  }
  return result;
}

async function verifyMixed(
  config: Record<string, unknown>,
  submission: Record<string, unknown>,
): Promise<OfflineVerificationResult> {
  const steps = config.steps as Array<Record<string, unknown>> | undefined;
  const stepSubs = submission.steps as Array<Record<string, unknown>> | undefined;
  if (!steps || !stepSubs) {
    return { status: 'ERROR', score: 0, feedback: 'Nieprawidłowa konfiguracja zadania mieszanego' };
  }

  let totalScore = 0;
  const stepFeedback: string[] = [];
  let anyPending = false;
  let allCorrect = true;
  let anyCorrect = false;

  for (let i = 0; i < steps.length; i++) {
    const stepCfg = steps[i];
    const stepSub = stepSubs[i];
    if (!stepSub) {
      allCorrect = false;
      stepFeedback.push(`Krok ${i + 1}: Brak odpowiedzi na ten krok`);
      continue;
    }
    const fakeTask: OfflineBundleTask = {
      // Only the fields verifyOffline reads matter here; the rest are unused.
      id: '',
      gameId: '',
      title: '',
      description: '',
      type: stepCfg.type as TaskType,
      unlockMethod: 'NONE' as UnlockMethod,
      orderIndex: 0,
      latitude: 0,
      longitude: 0,
      unlockConfig: {},
      verifyConfig: stepCfg,
      maxPoints: 0,
      timeLimitSec: null,
      storyContext: null,
      hints: [],
      requiresOnlineVerification: false,
      unsupportedOffline: false,
    };
    const stepResult = await verifyOffline(fakeTask, stepSub);
    totalScore += stepResult.score;
    stepFeedback.push(`Krok ${i + 1}: ${stepResult.feedback}`);
    if (stepResult.status === 'PENDING') anyPending = true;
    if (stepResult.status !== 'CORRECT') allCorrect = false;
    if (stepResult.status === 'CORRECT') anyCorrect = true;
  }

  if (anyPending) {
    return {
      status: 'PENDING',
      score: 0,
      feedback: stepFeedback.join('\n'),
    };
  }

  const avg = steps.length > 0 ? totalScore / steps.length : 0;
  return {
    status: allCorrect ? 'CORRECT' : anyCorrect ? 'PARTIAL' : 'INCORRECT',
    score: avg,
    feedback: stepFeedback.join('\n'),
  };
}

// Local re-import to avoid TS narrowing the union in verifyMixed's fakeTask.
type UnlockMethod = OfflineBundleTask['unlockMethod'];
