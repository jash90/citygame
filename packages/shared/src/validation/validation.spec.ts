import {
  loginSchema,
  registerSchema,
  createGameSchema,
  createTaskSchema,
  submissionSchema,
} from './index';

describe('loginSchema', () => {
  it('should accept valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'secret123' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({ email: 'notanemail', password: 'secret123' });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: '12345' });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'test@test.com' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('should accept valid registration data', () => {
    const result = registerSchema.safeParse({
      email: 'jan@example.com',
      password: 'Password1',
      displayName: 'Jan',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short displayName', () => {
    const result = registerSchema.safeParse({
      email: 'jan@example.com',
      password: 'Password1',
      displayName: 'J',
    });
    expect(result.success).toBe(false);
  });

  it('should reject too long displayName', () => {
    const result = registerSchema.safeParse({
      email: 'jan@example.com',
      password: 'Password1',
      displayName: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });
});

describe('createGameSchema', () => {
  const validGame = {
    title: 'Test Game',
    description: 'A test game with sufficient description length',
    city: 'Kraków',
  };

  it('should accept valid game data', () => {
    expect(createGameSchema.safeParse(validGame).success).toBe(true);
  });

  it('should accept game with optional settings', () => {
    const result = createGameSchema.safeParse({
      ...validGame,
      settings: { maxPlayers: 50, timeLimitMinutes: 120 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject too short title', () => {
    expect(createGameSchema.safeParse({ ...validGame, title: 'AB' }).success).toBe(false);
  });

  it('should reject too short description', () => {
    expect(createGameSchema.safeParse({ ...validGame, description: 'Short' }).success).toBe(false);
  });
});

describe('createTaskSchema', () => {
  const validTask = {
    title: 'Test Task',
    description: 'A test task with enough text to validate',
    type: 'GPS_REACH' as const,
    unlockMethod: 'GPS' as const,
    orderIndex: 0,
    latitude: 50.06,
    longitude: 19.94,
    unlockConfig: { method: 'GPS' as const, latitude: 50.06, longitude: 19.94, radiusMeters: 50 },
    verifyConfig: { type: 'GPS_REACH' as const, latitude: 50.06, longitude: 19.94, radiusMeters: 30 },
    maxPoints: 100,
  };

  it('should accept valid task', () => {
    expect(createTaskSchema.safeParse(validTask).success).toBe(true);
  });

  it('should reject invalid latitude', () => {
    expect(createTaskSchema.safeParse({ ...validTask, latitude: 100 }).success).toBe(false);
  });

  it('should reject negative maxPoints', () => {
    expect(createTaskSchema.safeParse({ ...validTask, maxPoints: -10 }).success).toBe(false);
  });
});

describe('submissionSchema', () => {
  it('should accept text answer', () => {
    expect(submissionSchema.safeParse({ answer: 'my answer' }).success).toBe(true);
  });

  it('should accept GPS coordinates', () => {
    expect(submissionSchema.safeParse({ latitude: 50.06, longitude: 19.94 }).success).toBe(true);
  });

  it('should accept media URL', () => {
    expect(submissionSchema.safeParse({ mediaUrl: 'https://example.com/img.jpg' }).success).toBe(true);
  });

  it('should accept empty object (all optional)', () => {
    expect(submissionSchema.safeParse({}).success).toBe(true);
  });
});
