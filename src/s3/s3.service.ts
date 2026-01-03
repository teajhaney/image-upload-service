import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
// import { GetObjectOutput } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private rawBucket = process.env.RAW_BUCKET;
  private processedBucket = process.env.PROCESSED_BUCKET;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.REGION ?? '',
      endpoint: process.env.ENDPOINT ?? '',
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.SECRET_ACCESS_KEY ?? '',
      },
      forcePathStyle: true,
    });
  }

  async upload(key: string, body: Buffer, bucket: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
    });
    await this.s3Client.send(command);
  }

  async download(key: string, bucket: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    return (await response.Body?.transformToByteArray()) as Buffer;
  }

  getUrl(bucket: string, key: string): string {
    return `http://localhost:9000/${bucket}/${key}`;
  }

  getRawBucket(): string {
    if (!this.rawBucket) {
      throw new Error('RAW_BUCKET environment variable is not set');
    }
    return this.rawBucket;
  }

  getProcessedBucket(): string {
    if (!this.processedBucket) {
      throw new Error('PROCESSED_BUCKET environment variable is not set');
    }
    return this.processedBucket;
  }
}
