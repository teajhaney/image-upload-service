import { InjectQueue } from '@nestjs/bullmq';
import { Controller } from '@nestjs/common';
import { Queue } from 'bullmq';
import { S3Service } from 'src/s3/s3.service';
import { StatusService } from 'src/status/status.service';

@Controller('upload')
export class UploadController {
  constructor(
    private s3Service: S3Service,
    private statusService: StatusService,
    @InjectQueue('image-processing') private processingQueue: Queue,
  ) {}
}
