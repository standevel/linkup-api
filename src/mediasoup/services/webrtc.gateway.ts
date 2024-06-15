import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
// import { MediasoupService } from '../mediasoup/mediasoup.service';
import { EVENT_NAME, RTC_EVENTS } from '../enums/rtc-events';
import { MediasoupService } from './mediasoup.service';

interface RTCEventPayload {
  event: RTC_EVENTS;
  data: any;
  error?: any;
}

@WebSocketGateway()
export class WebrtcGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly mediasoupService: MediasoupService) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(EVENT_NAME)
  async handleRTCEvent(client: Socket, payload: RTCEventPayload) {
    const { event, data } = payload;
    try {
      switch (event) {
        case RTC_EVENTS.CREATE_ROOM:
          await this.handleCreateRoom(client, data);
          break;
        case RTC_EVENTS.JOIN_ROOM:
          await this.handleJoinRoom(client, data);
          break;
        case RTC_EVENTS.CREATE_TRANSPORT:
          await this.handleCreateTransport(client, data);
          break;
        case RTC_EVENTS.CONNECT_TRANSPORT:
          await this.handleConnectTransport(client, data);
          break;
        case RTC_EVENTS.PRODUCE:
          await this.handleProduce(client, data);
          break;
        case RTC_EVENTS.CONSUME:
          await this.handleConsume(client, data);
          break;
        case RTC_EVENTS.CREATE_DATA_PRODUCER:
          await this.handleCreateDataProducer(client, data);
          break;
        case RTC_EVENTS.CREATE_DATA_CONSUMER:
          await this.handleCreateDataConsumer(client, data);
          break;
        case RTC_EVENTS.SEND_DATA:
          await this.handleSendData(client, data);
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
    console.log('created room: ', room);
    client.join(roomId);
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.CREATE_ROOM,
      data: { roomId },
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
    const { roomId } = data;
    const transport = await this.mediasoupService.createTransport(roomId);
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.CREATE_TRANSPORT,
      data: { transport },
    });
  }

  private async handleConnectTransport(client: Socket, data: any) {
    const { roomId, transportId, dtlsParameters } = data;
    await this.mediasoupService.connectTransport(
      roomId,
      transportId,
      dtlsParameters,
    );
    client.emit(EVENT_NAME, { event: RTC_EVENTS.CONNECT_TRANSPORT, data: {} });
  }

  private async handleProduce(client: Socket, data: any) {
    const { roomId, transportId, kind, rtpParameters } = data;
    const producer = await this.mediasoupService.produce(
      roomId,
      transportId,
      kind,
      rtpParameters,
    );
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.PRODUCE,
      data: { id: producer.id },
    });
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
