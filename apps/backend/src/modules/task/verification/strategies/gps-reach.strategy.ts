import { Injectable } from '@nestjs/common';
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

    const distance = this.haversineDistance(playerLat, playerLng, targetLat, targetLng);

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

  /**
   * Haversine formula to calculate the distance in metres between two GPS points.
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const EARTH_RADIUS_M = 6_371_000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_M * c;
  }
}
