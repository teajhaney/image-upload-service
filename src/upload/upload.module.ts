import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UploadController } from './controller/upload.controller';
import { ImageProcessor } from './image.processor';
import { S3Module } from 'src/s3/s3.module';
import { StatusModule } from 'src/status/status.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'image-processing',
    }),
    S3Module,
    StatusModule,
  ],
  controllers: [UploadController],
  providers: [ImageProcessor],
})
export class UploadModule {}
