import { GpsReachStrategy } from './gps-reach.strategy';

describe('GpsReachStrategy', () => {
  let strategy: GpsReachStrategy;

  beforeEach(() => {
    strategy = new GpsReachStrategy();
  });

  it('should return CORRECT when within radius', async () => {
    const result = await strategy.verify(
      { targetLat: 50.06, targetLng: 19.94, radiusMeters: 100 },
      { latitude: 50.0601, longitude: 19.9401 },
    );
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1.0);
  });

  it('should return INCORRECT when outside radius', async () => {
    const result = await strategy.verify(
      { targetLat: 50.06, targetLng: 19.94, radiusMeters: 10 },
      { latitude: 50.07, longitude: 19.95 },
    );
    expect(result.status).toBe('INCORRECT');
    expect(result.score).toBe(0);
  });

  it('should return CORRECT when exactly at target', async () => {
    const result = await strategy.verify(
      { targetLat: 50.06, targetLng: 19.94, radiusMeters: 1 },
      { latitude: 50.06, longitude: 19.94 },
    );
    expect(result.status).toBe('CORRECT');
  });

  it('should return ERROR when player coordinates missing', async () => {
    const result = await strategy.verify(
      { targetLat: 50.06, targetLng: 19.94, radiusMeters: 100 },
      {},
    );
    expect(result.status).toBe('ERROR');
  });

  it('should return ERROR when target coordinates missing', async () => {
    const result = await strategy.verify(
      { radiusMeters: 100 },
      { latitude: 50.06, longitude: 19.94 },
    );
    expect(result.status).toBe('ERROR');
  });

  it('should default radiusMeters to 20 when not specified', async () => {
    // Point ~15m away should pass with default 20m radius
    const result = await strategy.verify(
      { targetLat: 50.06, targetLng: 19.94 },
      { latitude: 50.06001, longitude: 19.94001 },
    );
    expect(result.status).toBe('CORRECT');
  });
});
