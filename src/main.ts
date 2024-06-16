import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
// import { IoAdapter } from '@nestjs/platform-socket.io';
import * as bodyParser from 'body-parser';
import { RedisIoAdapter } from './redis.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(bodyParser.json({ limit: '200mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));

  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('/api/');
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();

  app.useWebSocketAdapter(redisIoAdapter);

  // app.startAllMicroservices()
  await app.listen(process.env.PORT ? parseInt(process.env.PORT) : 3000);
  // await app.listen(port);
}
bootstrap();
