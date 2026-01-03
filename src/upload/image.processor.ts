import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import sharp from 'sharp';
import { S3Service } from 'src/s3/s3.service';
import { StatusService } from 'src/status/status.service';

@Processor('image-processing')
export class ImageProcessor extends WorkerHost {
  constructor(
    private s3Service: S3Service,
    private statusService: StatusService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string; rawKey: string }>): Promise<void> {
    switch (job.name) {
      case 'process-image':
        await this.processImage(job);
        break;
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async processImage(
    job: Job<{ jobId: string; rawKey: string }>,
  ): Promise<void> {
    const { jobId, rawKey } = job.data;

    try {
      //Update status
      await this.statusService.setStatus(jobId, 'processing');

      //download raw
      const rawBuffer = await this.s3Service.download(
        rawKey,
        this.s3Service.getRawBucket(),
      );

      //Process with sharp
      // Validate buffer is not empty
      if (!rawBuffer || rawBuffer.length === 0) {
        throw new Error('Downloaded file is empty');
      }

      const baseName = rawKey.split('.')[0];
      const processedKey = `${baseName}-processed.jpg`;
      const thumbnailKey = `${baseName}-thumbnail.jpg`;

      //Resize and compress
      const processedBuffer = await sharp(rawBuffer)
        .resize({
          width: 800,
          height: 600,
          fit: 'inside',
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      //Thumbnail (150x150)
      const thumbBuffer = await sharp(rawBuffer)
        .resize(150, 150, {
          fit: 'cover',
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Upload processed image
      await this.s3Service.upload(
        processedKey,
        processedBuffer,
        this.s3Service.getProcessedBucket(),
      );

      await this.s3Service.upload(
        thumbnailKey,
        thumbBuffer,
        this.s3Service.getProcessedBucket(),
      );

      // Generate presigned URLs (valid for 7 days)
      const processedUrl = await this.s3Service.getPresignedUrl(
        this.s3Service.getProcessedBucket(),
        processedKey,
        604800, // 7 days in seconds
      );

      const thumbnailUrl = await this.s3Service.getPresignedUrl(
        this.s3Service.getProcessedBucket(),
        thumbnailKey,
        604800, // 7 days in seconds
      );

      // Update status to complete
      await this.statusService.setStatus(jobId, 'completed', {
        url: [processedUrl, thumbnailUrl],
      });
    } catch (error) {
      await this.statusService.setStatus(jobId, 'failed', {
        error: (error as Error).message,
      });
      throw error; // For BullMQ retry
    }
  }
}
