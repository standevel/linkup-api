import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';

import * as bodyParser from 'body-parser';
import { RedisIoAdapter } from './redis.adapter';

import { networkInterfaces } from 'os';

// const getPublicIp = async () => {
//   const response = await new Promise((resolve, reject) => {
//     get({ host: 'api.ipify.org', path: '/', port: 80 }, (res) => {
//       let ip = '';
//       res.on('data', (chunk) => {
//         ip += chunk;
//       });
//       res.on('end', () => {
//         console.log('ip value ', ip);
//         resolve(ip);
//       });
//     }).on('error', (error) => {
//       reject(error);
//     });
//   });

//   console.log('response ', response);

//   return response.toString();
// };
const getIPv4 = () => {
  const ifaces = networkInterfaces();
  for (const interfaceName in ifaces) {
    const iface = ifaces[interfaceName];
    for (const { address, family, internal } of iface) {
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return '0.0.0.0'; // Default to 0.0.0.0 if no external IPv4 address found
};

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
  const ip = getIPv4();

  console.log('ipv4: ', ip);

  // config.mediasoup.webRtcTransport.listenIps.forEach((lip) => {
  // lip.ip = ip;
  // lip.announcedIp = ip;
  // });

  // console.log('config: ', config.webRtcTransport);

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();

  app.useWebSocketAdapter(redisIoAdapter);

  // app.startAllMicroservices()
  await app.listen(process.env.PORT ? parseInt(process.env.PORT) : 3000);
}
bootstrap();
