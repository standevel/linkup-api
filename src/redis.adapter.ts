import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
export const pubClient = createClient({
  url: `redis://34.91.233.227:6379`,
  password:
    process.env.REDIS_PASSWORD ||
    'bmRrc2hha2hmYWRzdWZnaGlkbHVzZml1Z2RlaWhmbGRobGtmaG9pZHdoZmxpdWdydWZoa2pkaGZramh3ZGl1Z2ZpdQ==',
});

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    try {
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);

      pubClient.on('error', (error) => {
        console.error(`Redis Adapter PubClient Error: ${error}`);
      });

      subClient.on('error', (error) => {
        console.error(`Redis Adapter SubClient Error: ${error}`);
      });
      pubClient.on('connect', (con) => {
        console.error(`Redis Adapter connected: ${con}`);
      });

      subClient.on('connect', (con) => {
        console.error(`Redis Adapter SubClient Error: ${con}`);
      });
    } catch (error) {
      console.log('Error connecting to redis');
    }
  }
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
