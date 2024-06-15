import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MediasoupModule } from './mediasoup/mediasoup.module';
import { WebrtcGateway } from './mediasoup/services/webrtc.gateway';

@Module({
  imports: [MediasoupModule],
  controllers: [AppController],
  providers: [AppService, WebrtcGateway],
})
export class AppModule {}
