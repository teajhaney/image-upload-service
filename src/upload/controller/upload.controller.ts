import { InjectQueue } from '@nestjs/bullmq';
import {
  Controller,
  ConflictException,
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
import { S3Service } from '../../s3/s3.service';
import { StatusService } from '../../status/status.service';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}
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
  ): Promise<ApiResponse<{ jobId: string }>> {
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

    return {
      statusCode: 201,
      message: 'File uploaded successfully',
      data: { jobId },
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':jobId/status')
  async getStatus(
    @Param('jobId') jobId: string,
  ): Promise<ApiResponse<{ status: string }>> {
    const statusData = await this.statusService.getStatus(jobId);
    if (!statusData) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }
    return {
      statusCode: 200,
      message: 'Job status retrieved',
      data: { status: statusData.status },
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':jobId/result')
  async getResult(
    @Param('jobId') jobId: string,
  ): Promise<ApiResponse<{ status: string; result: any }>> {
    const statusData = await this.statusService.getStatus(jobId);
    if (!statusData) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }
    if (statusData.status !== 'completed') {
      throw new ConflictException('Job not completed');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return {
      statusCode: 200,
      message: 'Job result retrieved',
      data: { status: statusData.status, result: statusData.result },
      timestamp: new Date().toISOString(),
    };
  }
}
