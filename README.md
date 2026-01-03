# Image Upload & Processing Service

A robust, scalable image upload and processing service built with NestJS. This service handles image uploads, asynchronous processing, resizing, compression, and thumbnail generation using background job queues.

## Features

- 📤 **Image Upload** - Upload images via REST API with support for various image formats
- 🔄 **Asynchronous Processing** - Background job processing using BullMQ and Redis
- 🖼️ **Image Processing** - Automatic image resizing and compression using Sharp
- 🎯 **Thumbnail Generation** - Generate thumbnails (150x150) alongside processed images
- 💾 **Object Storage** - Store images in MinIO/S3-compatible storage
- 🔐 **Secure Access** - Presigned URLs for secure, time-limited access to images
- 📊 **Job Status Tracking** - Real-time job status tracking with Redis
- 🚀 **Scalable Architecture** - Built with NestJS for high performance and scalability

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) - Progressive Node.js framework
- **Language**: TypeScript
- **Queue System**: [BullMQ](https://docs.bullmq.io/) - Redis-based queue system
- **Image Processing**: [Sharp](https://sharp.pixelplumbing.com/) - High-performance image processing
- **Object Storage**: MinIO / AWS S3 (via AWS SDK v3)
- **Cache/Queue Backend**: Redis (via ioredis)
- **File Upload**: Multer

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Redis** (v6 or higher) - For job queues and status tracking
- **MinIO** (or AWS S3) - For object storage

### Installing Prerequisites

#### Redis
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:latest
```

#### MinIO
```bash
# macOS (using Homebrew)
brew install minio/stable/minio
minio server ~/minio-data

# Docker
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Or download from https://min.io/download
```

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd image-uplaod-service
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Configure environment variables**

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000

# AWS S3 / MinIO Configuration
REGION=us-east-1
ENDPOINT=http://localhost:9000
ACCESS_KEY_ID=minioadmin
SECRET_ACCESS_KEY=minioadmin
RAW_BUCKET=raw-uploads
PROCESSED_BUCKET=processed-images

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
```

5. **Create MinIO buckets**

Make sure the buckets specified in your `.env` file exist in MinIO:

- `raw-uploads` (or your `RAW_BUCKET` value)
- `processed-images` (or your `PROCESSED_BUCKET` value)

You can create buckets via MinIO Console (http://localhost:9001) or using the MinIO client.

6. **Start the application**
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Upload Image

Upload an image file for processing.

**Endpoint**: `POST /upload`

**Content-Type**: `multipart/form-data`

**Body**:
- `file` (file): Image file to upload

**Response**:
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Example** (using curl):
```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@/path/to/your/image.jpg"
```

### Get Job Status

Check the status of an image processing job.

**Endpoint**: `GET /upload/:jobId/status`

**Response**:
```json
{
  "status": "pending" | "processing" | "completed" | "failed"
}
```

**Example**:
```bash
curl http://localhost:3000/upload/550e8400-e29b-41d4-a716-446655440000/status
```

### Get Job Result

Retrieve the processed image URLs after job completion.

**Endpoint**: `GET /upload/:jobId/result`

**Response** (when completed):
```json
{
  "status": "completed",
  "result": {
    "url": [
      "http://localhost:9000/processed-images/...-processed.jpg?X-Amz-Algorithm=...",
      "http://localhost:9000/processed-images/...-thumbnail.jpg?X-Amz-Algorithm=..."
    ]
  }
}
```

**Response** (when not completed):
```json
{
  "error": "Job not completed"
}
```

**Example**:
```bash
curl http://localhost:3000/upload/550e8400-e29b-41d4-a716-446655440000/result
```

## Architecture

### Flow Diagram

```
1. Client uploads image
   ↓
2. Image stored in raw-uploads bucket
   ↓
3. Job added to BullMQ queue
   ↓
4. Status set to "pending"
   ↓
5. Worker processes job (async):
   - Download raw image
   - Resize to 800x600 (maintain aspect ratio)
   - Generate 150x150 thumbnail
   - Upload processed images
   - Generate presigned URLs (7-day expiry)
   - Update status to "completed"
```

### Components

- **UploadController**: Handles HTTP requests for image uploads and status checks
- **ImageProcessor**: Background worker that processes images using Sharp
- **S3Service**: Manages interactions with MinIO/S3 (upload, download, presigned URLs)
- **StatusService**: Tracks job status in Redis
- **BullMQ Queue**: Manages asynchronous job processing

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts          # Root module
├── app.controller.ts      # Root controller
├── app.service.ts         # Root service
│
├── upload/                # Upload module
│   ├── upload.module.ts
│   ├── controller/
│   │   └── upload.controller.ts    # Upload endpoints
│   └── image.processor.ts           # Background image processor
│
├── s3/                    # S3/MinIO module
│   ├── s3.module.ts
│   └── s3.service.ts      # S3 operations (upload, download, presigned URLs)
│
└── status/                # Status tracking module
    ├── status.module.ts
    └── status.service.ts  # Redis-based status tracking

test/                      # E2E tests
.env                       # Environment variables (create from .env.example)
```

## Image Processing Details

### Processed Image
- **Dimensions**: 800x600 (fit inside, maintains aspect ratio)
- **Format**: JPEG
- **Quality**: 85%
- **Progressive**: Enabled

### Thumbnail
- **Dimensions**: 150x150 (cover, crops to fit)
- **Format**: JPEG
- **Quality**: 85%

## Development

### Available Scripts

```bash
# Development
npm run start:dev          # Start in watch mode
npm run start:debug        # Start in debug mode

# Building
npm run build              # Build for production
npm run start:prod         # Start production build

# Code Quality
npm run lint               # Run ESLint
npm run format             # Format code with Prettier

# Testing
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run tests with coverage
npm run test:e2e           # Run end-to-end tests
```

### Code Style

This project uses:
- **ESLint** for linting
- **Prettier** for code formatting
- **TypeScript** strict mode

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `REGION` | AWS region / MinIO region | `us-east-1` | No |
| `ENDPOINT` | MinIO/S3 endpoint | - | Yes |
| `ACCESS_KEY_ID` | S3 access key | - | Yes |
| `SECRET_ACCESS_KEY` | S3 secret key | - | Yes |
| `RAW_BUCKET` | Bucket for raw uploads | - | Yes |
| `PROCESSED_BUCKET` | Bucket for processed images | - | Yes |
| `REDIS_HOST` | Redis host | `localhost` | No |
| `REDIS_PORT` | Redis port | `6379` | No |

### MinIO Setup

1. Start MinIO server
2. Access MinIO Console at http://localhost:9001
3. Create buckets:
   - `raw-uploads` (or your `RAW_BUCKET` value)
   - `processed-images` (or your `PROCESSED_BUCKET` value)
4. Configure access policies (buckets are private by default)

### Redis Setup

Ensure Redis is running and accessible. The service uses Redis for:
- BullMQ job queues
- Job status tracking

## Security Considerations

- **Presigned URLs**: Images are accessed via presigned URLs with 7-day expiration
- **Private Buckets**: All buckets are private by default
- **Input Validation**: File uploads are validated
- **Error Handling**: Comprehensive error handling prevents information leakage

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:cov
```

## Deployment

### Production Build

```bash
npm run build
npm run start:prod
```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

### Environment Variables in Production

Ensure all environment variables are set in your production environment. Consider using:
- Environment variable management tools
- Secret management services (AWS Secrets Manager, HashiCorp Vault)
- Container orchestration platforms (Kubernetes ConfigMaps/Secrets)

## Troubleshooting

### Common Issues

**1. "Region is missing" error**
- Ensure `REGION` is set in `.env` (defaults to `us-east-1`)

**2. "Access Denied" when accessing images**
- Images use presigned URLs. Ensure URLs are generated correctly
- Check MinIO bucket permissions
- Verify `ACCESS_KEY_ID` and `SECRET_ACCESS_KEY` are correct

**3. Redis connection errors**
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_HOST` and `REDIS_PORT` in `.env`

**4. Image processing fails**
- Ensure Sharp can process the image format
- Check file size limits
- Verify MinIO buckets exist

**5. Jobs stuck in "pending" status**
- Check if BullMQ workers are running
- Verify Redis connection
- Check worker logs for errors

## Performance Considerations

- **Queue Processing**: Jobs are processed asynchronously, allowing the API to remain responsive
- **Image Processing**: Sharp is optimized for performance and handles large images efficiently
- **Presigned URLs**: URLs are valid for 7 days, reducing regeneration overhead
- **Scalability**: BullMQ allows horizontal scaling of workers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is private and unlicensed.

## Support

For issues and questions:
- Open an issue on the repository
- Check existing documentation
- Review NestJS documentation: https://docs.nestjs.com

## Acknowledgments

- [NestJS](https://nestjs.com/) - The progressive Node.js framework
- [Sharp](https://sharp.pixelplumbing.com/) - High-performance image processing
- [BullMQ](https://docs.bullmq.io/) - Redis-based queue system
- [MinIO](https://min.io/) - Object storage
