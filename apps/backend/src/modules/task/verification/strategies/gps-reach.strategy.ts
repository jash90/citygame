import { Injectable } from '@nestjs/common';
import { haversineDistance } from '../../../../common/utils/geo';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * GPS_REACH verification: check player is within radiusMeters of the target.
 *
 * verifyConfig shape: { targetLat: number; targetLng: number; radiusMeters: number }
 * submission shape:   { latitude: number; longitude: number }
 */
@Injectable()
export class GpsReachStrategy implements VerificationStrategy {
  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const targetLat = config['targetLat'] as number | undefined;
    const targetLng = config['targetLng'] as number | undefined;
    const radiusMeters = (config['radiusMeters'] as number | undefined) ?? 20;

    const playerLat = submission['latitude'] as number | undefined;
    const playerLng = submission['longitude'] as number | undefined;

    if (
      targetLat == null ||
      targetLng == null ||
      playerLat == null ||
      playerLng == null
    ) {
      return {
        status: 'ERROR',
        score: 0,
        feedback: 'Missing GPS coordinates',
      };
    }

    const distance = haversineDistance(playerLat, playerLng, targetLat, targetLng);

    if (distance <= radiusMeters) {
      return {
        status: 'CORRECT',
        score: 1.0,
        feedback: `You are ${Math.round(distance)}m from the target. Close enough!`,
      };
    }

    return {
      status: 'INCORRECT',
      score: 0,
      feedback: `You are ${Math.round(distance)}m away, need to be within ${radiusMeters}m`,
    };
  }

}
