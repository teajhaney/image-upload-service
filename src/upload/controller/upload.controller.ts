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
import { diskStorage } from 'multer';
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ jobId: string }> {
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
    const status = await this.statusService.getStatus(jobId);
    if (!status) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }
    return status;
  }

  @Get(':jobId/result')
  async getResult(@Param('jobId') jobId: string) {
    const status = await this.statusService.getStatus(jobId);
    if (!status || status.result !== 'completed')
      return { error: 'Job not completed' };
    return status;
  }
}
