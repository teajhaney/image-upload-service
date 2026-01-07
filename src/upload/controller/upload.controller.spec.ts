import { Test, TestingModule } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { S3Service } from '../../s3/s3.service';
import { StatusService } from '../../status/status.service';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UploadController Response', () => {
  let controller: UploadController;
  let s3Service: S3Service;
  let statusService: StatusService;

  const mockS3Service = {
    upload: jest.fn(),
    getRawBucket: jest.fn().mockReturnValue('test-bucket'),
  };

  const mockStatusService = {
    setStatus: jest.fn(),
    getStatus: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: S3Service, useValue: mockS3Service },
        { provide: StatusService, useValue: mockStatusService },
        { provide: getQueueToken('image-processing'), useValue: mockQueue },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    s3Service = module.get<S3Service>(S3Service);
    statusService = module.get<StatusService>(StatusService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should return standardized response', async () => {
      const file = {
        originalname: 'test.png',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const result = await controller.upload(file);

      expect(result.statusCode).toBe(201);
      expect(result.message).toBe('File uploaded successfully');
      expect(result.data.jobId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(mockS3Service.upload).toHaveBeenCalled();
      expect(mockStatusService.setStatus).toHaveBeenCalledWith(
        expect.any(String),
        'pending',
      );
    });
  });

  describe('getStatus', () => {
    it('should return standardized response', async () => {
      const jobId = '123';
      (mockStatusService.getStatus as jest.Mock).mockResolvedValue({
        status: 'pending',
      });

      const result = await controller.getStatus(jobId);

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Job status retrieved');
      expect(result.data.status).toBe('pending');
      expect(result.timestamp).toBeDefined();
    });

    it('should throw NotFoundException if job not found', async () => {
      (mockStatusService.getStatus as jest.Mock).mockResolvedValue(null);
      await expect(
        controller.getStatus('invalid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getResult', () => {
    it('should return standardized response if completed', async () => {
      const jobId = '123';
      (mockStatusService.getStatus as jest.Mock).mockResolvedValue({
        status: 'completed',
        result: 'processed.png',
      });

      const result = await controller.getResult(jobId);

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Job result retrieved');
      expect(result.data.status).toBe('completed');
      expect(result.data.result).toBe('processed.png');
    });

    it('should throw ConflictException if not completed', async () => {
      const jobId = '123';
      (mockStatusService.getStatus as jest.Mock).mockResolvedValue({
        status: 'processing',
      });

      await expect(controller.getResult(jobId)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
