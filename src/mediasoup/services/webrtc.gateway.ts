import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EVENT_NAME, RTC_EVENTS } from '../enums/rtc-events';
import { MediasoupService } from './mediasoup.service';

interface RTCEventPayload {
  event: RTC_EVENTS;
  data: any;
  error?: any;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebrtcGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: Server;

  constructor(private readonly mediasoupService: MediasoupService) {}

  afterInit() {
    console.log('Gateway initialized ');
  }

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('test-callback')
  handlecallback(client: Socket, data: any) {
    console.log('test data: ', data);
    return { socketId: client.id, message: 'This is callback message' };
  }
  @SubscribeMessage(EVENT_NAME)
  async handleRTCEvent(client: Socket, payload: RTCEventPayload) {
    const { event, data } = payload;
    console.log('Payload: ', payload);
    try {
      switch (event) {
        case RTC_EVENTS.CREATE_ROOM:
          return await this.handleCreateRoom(client, data);
          break;
        case RTC_EVENTS.JOIN_ROOM:
          return await this.handleJoinRoom(client, data);
          break;
        case RTC_EVENTS.CREATE_TRANSPORT:
          return await this.handleCreateTransport(client, data);
          break;
        case RTC_EVENTS.CONNECT_TRANSPORT:
          return await this.handleConnectTransport(client, data);
          break;
        case RTC_EVENTS.PRODUCE:
          return await this.handleProduce(client, data);
          break;
        case RTC_EVENTS.CONSUME:
          return await this.handleConsume(client, data);
          break;
        case RTC_EVENTS.CREATE_DATA_PRODUCER:
          return await this.handleCreateDataProducer(client, data);
          break;
        case RTC_EVENTS.CREATE_DATA_CONSUMER:
          return await this.handleCreateDataConsumer(client, data);
          break;
        case RTC_EVENTS.SEND_DATA:
          return await this.handleSendData(client, data);
          break;
        default:
          client.emit(EVENT_NAME, { event, error: 'Unknown event' });
      }
    } catch (error) {
      client.emit(EVENT_NAME, { event, error: error.message });
    }
  }

  private async handleCreateRoom(client: Socket, data: any) {
    const { roomId } = data;
    const room = await this.mediasoupService.createRoom(roomId);
    // console.log('created room rtpCapabilities: ', room.router.rtpCapabilities);
    client.join(roomId);
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.CREATE_ROOM,
      data: { routerRtpCapabilities: room.router.rtpCapabilities, roomId },
    });
  }

  private async handleJoinRoom(client: Socket, data: any) {
    const { roomId } = data;
    const room = this.mediasoupService.getRoom(roomId);
    if (!room) {
      client.emit(EVENT_NAME, {
        event: RTC_EVENTS.JOIN_ROOM,
        error: 'Room not found',
      });
      return;
    }
    client.join(roomId);
    client.emit(EVENT_NAME, { event: RTC_EVENTS.JOIN_ROOM, data: { roomId } });
  }

  private async handleCreateTransport(client: Socket, data: any) {
    const { roomId, direction } = data;
    const transport = await this.mediasoupService.createTransport(roomId);

    const { id, iceParameters, iceCandidates, dtlsParameters } = transport;

    console.log('Transport: ', transport.id);
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.CREATE_TRANSPORT,
      data: {
        id: id,
        iceCandidates,
        iceParameters,
        dtlsParameters,
        roomId,
        direction,
      },
    });
  }

  private async handleConnectTransport(client: Socket, data: any) {
    const { roomId, transportId, dtlsParameters, direction } = data;
    console.log('connect transport direction: ', direction);
    await this.mediasoupService.connectTransport(
      roomId,
      transportId,
      dtlsParameters,
    );
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.CONNECT_TRANSPORT,
      data: { roomId, transportId, dtlsParameters, direction },
    });
    return { transportId: transportId };
  }

  private async handleProduce(client: Socket, data: any) {
    const { roomId, transportId, kind, rtpParameters } = data;
    console.log('producing media - kind: ', kind);
    const producer = await this.mediasoupService.produce(
      roomId,
      transportId,
      kind,
      rtpParameters,
    );
    // client.emit(EVENT_NAME, {
    //   event: RTC_EVENTS.PRODUCE,
    //   data: { id: producer.id },
    // });
    return { producer_id: producer.id };
  }

  private async handleConsume(client: Socket, data: any) {
    const { roomId, transportId, producerId, rtpCapabilities } = data;
    const consumer = await this.mediasoupService.consume(
      roomId,
      transportId,
      producerId,
      rtpCapabilities,
    );
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.CONSUME,
      data: { id: consumer.id, producerId },
    });
  }

  private async handleCreateDataProducer(client: Socket, data: any) {
    const { roomId, transportId, label, protocol } = data;
    const dataProducer = await this.mediasoupService.createDataProducer(
      roomId,
      transportId,
      label,
      protocol,
    );
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.CREATE_DATA_PRODUCER,
      data: { id: dataProducer.id },
    });
  }

  private async handleCreateDataConsumer(client: Socket, data: any) {
    const { roomId, transportId, dataProducerId } = data;
    const dataConsumer = await this.mediasoupService.createDataConsumer(
      roomId,
      transportId,
      dataProducerId,
    );
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.CREATE_DATA_CONSUMER,
      data: { id: dataConsumer.id },
    });
  }

  private async handleSendData(client: Socket, data: any) {
    // Implement logic for handling data channels
    console.log('sent data: ', data);
    client.emit(EVENT_NAME, { event: RTC_EVENTS.SEND_DATA, data: {} });
  }
}
