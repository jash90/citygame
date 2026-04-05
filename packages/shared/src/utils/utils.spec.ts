import { haversineDistance, calculatePoints, formatDuration } from './index';

describe('haversineDistance', () => {
  it('should return 0 for the same point', () => {
    expect(haversineDistance(50.06, 19.94, 50.06, 19.94)).toBe(0);
  });

  it('should calculate distance between two known points', () => {
    // Kraków Rynek → Wawel, roughly ~800m
    const distance = haversineDistance(50.0617, 19.9373, 50.054, 19.9352);
    expect(distance).toBeGreaterThan(700);
    expect(distance).toBeLessThan(1000);
  });

  it('should be symmetric', () => {
    const d1 = haversineDistance(50.06, 19.94, 51.1, 17.04);
    const d2 = haversineDistance(51.1, 17.04, 50.06, 19.94);
    expect(d1).toBeCloseTo(d2, 2);
  });

  it('should handle antipodal points', () => {
    // ~20,000 km
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(20_000_000);
  });
});

describe('calculatePoints', () => {
  it('should return maxPoints when no hints used', () => {
    expect(calculatePoints(100, 0, [10, 20])).toBe(100);
  });

  it('should subtract penalties for used hints', () => {
    expect(calculatePoints(100, 1, [10, 20])).toBe(90);
    expect(calculatePoints(100, 2, [10, 20])).toBe(70);
  });

  it('should not go below 0', () => {
    expect(calculatePoints(50, 3, [20, 20, 20])).toBe(0);
  });

  it('should handle empty penalties array', () => {
    expect(calculatePoints(100, 0, [])).toBe(100);
  });

  it('should handle hints exceeding available penalties', () => {
    expect(calculatePoints(100, 5, [10, 20])).toBe(70);
  });
});

describe('formatDuration', () => {
  it('should format 0 seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('should format seconds under a minute', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('should format exact minutes', () => {
    expect(formatDuration(120)).toBe('2:00');
  });

  it('should pad single digit seconds', () => {
    expect(formatDuration(65)).toBe('1:05');
  });

  it('should format large durations', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });
});
