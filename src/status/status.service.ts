import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class StatusService {
  private redis = new Redis('redis://localhost:6379');

  async setStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'complete' | 'failed',
    result?: any,
  ): Promise<void> {
    const hashData: Record<string, string> = {
      status,
    };
    if (result) {
      hashData.result = JSON.stringify(result);
    }
    await this.redis.hset(`job:${jobId}`, hashData);
  }

  async getStatus(jobId: string): Promise<{
    status: string;
    result?: any;
  } | null> {
    const data = await this.redis.hgetall(`job:${jobId}`);
    if (Object.keys(data).length === 0) return null;
    const response: { status: string; result?: any } = {
      status: data.status,
    };
    if (data.result) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      response.result = JSON.parse(data.result);
    }
    return response;
  }
}
