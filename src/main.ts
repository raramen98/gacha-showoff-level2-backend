import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { KoreanExceptionFilter } from './common/korean-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });
  app.useGlobalFilters(new KoreanExceptionFilter());

  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port);
  console.log(`🎰 백엔드 실행 중: http://localhost:${port}  (DB 상태: http://localhost:${port}/health)`);
}

bootstrap();
