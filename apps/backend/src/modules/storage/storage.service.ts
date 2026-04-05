import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicUrl: string | undefined;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.getOrThrow<string>('R2_ENDPOINT');
    this.bucket = this.configService.getOrThrow<string>('R2_BUCKET');
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL');

    this.client = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY'),
        secretAccessKey: this.configService.getOrThrow<string>('R2_SECRET_KEY'),
      },
    });
  }

  /**
   * Generate a presigned PUT URL so clients can upload directly to R2.
   * The URL expires in 15 minutes.
   *
   * @param key         Object key (path) inside the bucket.
   * @param contentType MIME type of the file being uploaded.
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; fileUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 900,
    });

    const fileUrl = this.getFileUrl(key);

    return { uploadUrl, fileUrl };
  }

  /**
   * Build the public URL for a stored object.
   * Uses R2_PUBLIC_URL (CDN/custom domain) when configured.
   */
  getFileUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    return `${this.endpoint}/${this.bucket}/${key}`;
  }
}
