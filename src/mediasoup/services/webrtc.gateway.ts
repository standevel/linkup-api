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
import { Logger } from '@nestjs/common';
// import { get } from 'node:http';

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
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;

  constructor(private readonly mediasoupService: MediasoupService) { }

  afterInit() {
    Logger.log('Gateway initialized ');
  }

  async handleConnection(client: Socket) {
    Logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    Logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('test-callback')
  async handlecallback(client: Socket, data: any) {
    Logger.log('test data: ', data);
    // const ip = await this.getPublicIp();
    // Logger.log('found ip: ', ip);
    return { socketId: client.id, message: 'This is callback message' };
  }
  @SubscribeMessage(EVENT_NAME)
  async handleRTCEvent(client: Socket, payload: RTCEventPayload) {
    const { event, data } = payload;
    // Logger.log('Payload: ', payload);

    try {
      switch (event) {
        case RTC_EVENTS.CREATE_ROOM:
          return await this.handleCreateRoom(client, data);

        case RTC_EVENTS.JOIN_ROOM:
          return await this.handleJoinRoom(client, data);

        case RTC_EVENTS.CREATE_TRANSPORT:
          return await this.handleCreateTransport(client, data);

        case RTC_EVENTS.CONNECT_TRANSPORT:
          return await this.handleConnectTransport(client, data);

        case RTC_EVENTS.PRODUCE:
          return await this.handleProduce(client, data);

        case RTC_EVENTS.CONSUME:
          return await this.handleConsume(client, data);

        case RTC_EVENTS.PRODUCER_DATA:
          return await this.handleCreateDataProducer(client, data);

        case RTC_EVENTS.CREATE_DATA_CONSUMER:
          return await this.handleCreateDataConsumer(client, data);

        case RTC_EVENTS.SEND_DATA:
          return await this.handleSendData(client, data);

        case RTC_EVENTS.GET_EXISTING_ROOM_PRODUCERS:
          return await this.handleGetExistingProducers(client, data);
        case RTC_EVENTS.RESUME_CONSUMER:
          return this.handleResumeConsumer(client, data);
        default:
          client.emit(EVENT_NAME, { event, error: 'Unknown event' });
      }
    } catch (error) {
      client.emit(EVENT_NAME, { event, error: error.message });
    }
  }
  private async joinRoom(
    client: Socket,
    data: { roomId: string; displayName: string },
  ) {
    client.join(data.roomId);
    const room = await this.mediasoupService.getRoomRouter(data.roomId);
    return {
      roomId: data.roomId,
      routerRtpCapabilities: room.router.rtpCapabilities,
    };
  }
  async handleGetExistingProducers(
    client: Socket,
    data: { roomId: string; userProducerId: string },
  ) {
    console.log('roomId in get producers: ', data.roomId);
    const producers = await this.mediasoupService.geExistingRoomProducers(
      data.roomId,
      data.userProducerId,
    );
    console.log('Existing producers: ', producers);
    const producersData = [];
    producers.forEach((producer) => {
      producersData.push({ id: producer.id, appData: producer.appData });
    });
    return producersData;
  }
  private async handleCreateRoom(client: Socket, data: any) {
    const { roomId } = data;
    const room = await this.mediasoupService.createRoom(roomId);
    // Logger.log('created room rtpCapabilities: ', room.router.rtpCapabilities);
    client.join(roomId);
    // client.emit(EVENT_NAME, {
    //   event: RTC_EVENTS.CREATE_ROOM,
    //   data: { routerRtpCapabilities: room.router.rtpCapabilities, roomId },
    // });
    return { routerRtpCapabilities: room.router.rtpCapabilities, roomId };
  }

  private async handleJoinRoom(client: Socket, data: any) {
    const { roomId } = data;
    client.join(roomId);
    console.log('joining room: ', roomId);
    const room = this.mediasoupService.getRoom(roomId);
    if (!room) {
      client.emit(EVENT_NAME, {
        event: RTC_EVENTS.JOIN_ROOM,
        error: 'Room not found',
      });
    }
    return { routerRtpCapabilities: room.router.rtpCapabilities, roomId };

    // client.emit(EVENT_NAME, { event: RTC_EVENTS.JOIN_ROOM, data: { roomId } });
  }

  private async handleCreateTransport(client: Socket, data: any) {
    const { roomId, type } = data;
    const { id, iceParameters, iceCandidates, dtlsParameters } =
      await this.mediasoupService.createTransport(roomId);

    Logger.log('Transport: ', id);

    return {
      id: id,
      iceCandidates,
      iceParameters,
      dtlsParameters,
      roomId,
      type,
    };
  }

  private async handleConnectTransport(client: Socket, data: any) {
    const { roomId, id, dtlsParameters } = data;
    Logger.log('connect transport direction: ', data);
    await this.mediasoupService.connectTransport(roomId, id, dtlsParameters);

    return { transportId: id };
  }

  private async handleProduce(client: Socket, data: any) {
    const { roomId, transportId, kind, rtpParameters } = data;
    Logger.log('producing media - kind: ', kind);
    const producer = await this.mediasoupService.produce(
      roomId,
      transportId,
      kind,
      rtpParameters,
    );
    client.emit(EVENT_NAME, {
      event: RTC_EVENTS.NEW_PRODUCER,
      data: { id: producer.id },
    });
    return { producer_id: producer.id };
  }

  private async handleConsume(client: Socket, data: any) {
    const { roomId, consumerTransportId, producerId, rtpCapabilities } = data;
    console.log('consuming producer with transport: ', producerId);
    const consumer = await this.mediasoupService.consume(
      roomId,
      consumerTransportId,
      producerId,
      rtpCapabilities,
    );
    // client.emit(EVENT_NAME, {
    //   event: RTC_EVENTS.CONSUME,
    //   data: { id: consumer.id, producerId },
    // });
    return {
      id: consumer.id,
      producerId: consumer.producerId,
      rtpParameters: consumer.rtpParameters,
      // codecOptions: consumer.codecOptions,
      streamId: consumer.streamId,
      appData: consumer.appData,
      kind: consumer.kind,
    };
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
      event: RTC_EVENTS.PRODUCER_DATA,
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
    Logger.log('sent data: ', data);
    client.emit(EVENT_NAME, { event: RTC_EVENTS.SEND_DATA, data: {} });
  }
  async handleResumeConsumer(client: Socket, data: any) {
    const { consumerId, roomId } = data;
    const resumeResponse = await this.mediasoupService.resumeConsumer(
      consumerId,
      roomId,
    );
    return resumeResponse;
  }
}

// postgresql://paytapdb_rmvt_user:TYdMG1ePMI4NelDiRTsiNECVP2HwGMWq@dpg-cop37uu3e1ms73bupb0g-a.oregon-postgres.render.com/paytapdb_rmvt
