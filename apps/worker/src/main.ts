import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger('Worker');

  logger.log('Bombay Falooda worker started');
  logger.log('Worker is running and listening for background jobs...');

  app.enableShutdownHooks();

  // Keep the process alive for scheduled tasks and background jobs
  process.stdin.resume();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received — shutting down worker gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received — shutting down worker gracefully...');
    await app.close();
    process.exit(0);
  });
}

void bootstrap();
