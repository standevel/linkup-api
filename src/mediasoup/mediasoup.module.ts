import { Module } from '@nestjs/common';
// import { MediasoupService1 } from './services/mediasoup.service1';
import { MediasoupService } from './services/mediasoup.service';

@Module({
  providers: [MediasoupService],
  exports: [MediasoupService],
})
export class MediasoupModule {}
