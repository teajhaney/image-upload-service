import { Module } from '@nestjs/common';
import { StatusService } from './status.service';

@Module({
  exports: [StatusService],
  providers: [StatusService],
})
export class StatusModule {}
