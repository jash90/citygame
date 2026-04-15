import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService, S3_CLIENT } from './storage.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned-url.example.com'),
}));

const mockConfig: Record<string, string> = {
  R2_ENDPOINT: 'https://r2.example.com',
  R2_BUCKET: 'test-bucket',
  R2_ACCESS_KEY: 'test-key',
  R2_SECRET_KEY: 'test-secret',
  R2_PUBLIC_URL: '',
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: S3_CLIENT,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (!(key in mockConfig)) throw new Error(`Missing ${key}`);
              return mockConfig[key];
            }),
            get: jest.fn((key: string, defaultVal?: string) => mockConfig[key] || defaultVal),
          },
        },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  describe('getPresignedUploadUrl', () => {
    it('returns upload and file URLs', async () => {
      const result = await service.getPresignedUploadUrl('photos/test.jpg', 'image/jpeg');

      expect(result.uploadUrl).toBe('https://presigned-url.example.com');
      expect(result.fileUrl).toContain('photos/test.jpg');
    });
  });

  describe('getFileUrl', () => {
    it('returns endpoint-based URL when no public URL configured', () => {
      const url = service.getFileUrl('photos/test.jpg');
      expect(url).toBe('https://r2.example.com/test-bucket/photos/test.jpg');
    });
  });
});

describe('StorageService with CDN URL', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: S3_CLIENT,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (!(key in mockConfig)) throw new Error(`Missing ${key}`);
              return mockConfig[key];
            }),
            get: jest.fn((key: string, defaultVal?: string) => {
              if (key === 'R2_PUBLIC_URL') return 'https://cdn.example.com';
              return mockConfig[key] || defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  it('uses CDN URL when R2_PUBLIC_URL is set', () => {
    const url = service.getFileUrl('photos/test.jpg');
    expect(url).toBe('https://cdn.example.com/photos/test.jpg');
  });
});
