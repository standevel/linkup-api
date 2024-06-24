import { Module } from '@nestjs/common';
// import { MediasoupService1 } from './services/mediasoup.service1';
import { MediasoupService } from './services/mediasoup.service';
import { WebrtcGateway } from './services/webrtc.gateway';

@Module({
  providers: [MediasoupService, WebrtcGateway],
  exports: [MediasoupService],
})
export class MediasoupModule { }
