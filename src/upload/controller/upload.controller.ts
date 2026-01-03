import { InjectQueue } from '@nestjs/bullmq';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { S3Service } from 'src/s3/s3.service';
import { StatusService } from 'src/status/status.service';

@Controller('upload')
export class UploadController {
  constructor(
    private s3Service: S3Service,
    private statusService: StatusService,
    @InjectQueue('image-processing') private processingQueue: Queue,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ jobId: string }> {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const jobId = uuidv4();
    const rawKey = `${jobId}-${file.originalname}`;

    //upload to minio
    await this.s3Service.upload(
      rawKey,
      file.buffer,
      this.s3Service.getRawBucket(),
    );

    //Queue job
    await this.processingQueue.add('process-image', { jobId, rawKey });

    //set initial status

    await this.statusService.setStatus(jobId, 'pending');

    return { jobId };
  }

  @Get(':jobId/status')
  async getStatus(@Param('jobId') jobId: string) {
    const statusData = await this.statusService.getStatus(jobId);
    if (!statusData) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }
    return { status: statusData.status };
  }

  @Get(':jobId/result')
  async getResult(@Param('jobId') jobId: string) {
    const statusData = await this.statusService.getStatus(jobId);
    if (!statusData) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }
    if (statusData.status !== 'completed') {
      return { error: 'Job not completed' };
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { status: statusData.status, result: statusData.result };
  }
}
