import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MediasoupService1 } from './mediasoup.service1';

@WebSocketGateway()
export class WebrtcGateway1
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(private readonly mediasoupService: MediasoupService1) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(client: Socket, roomId: string) {
    const room = await this.mediasoupService.createRoom(roomId);
    console.log('created room: ', room);
    client.join(roomId);
    client.emit('roomCreated', { roomId });
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(client: Socket, roomId: string) {
    const room = this.mediasoupService.getRoom(roomId);
    if (!room) {
      client.emit('error', { message: 'Room not found' });
      return;
    }
    client.join(roomId);
    client.emit('joinedRoom', { roomId });
  }

  @SubscribeMessage('createTransport')
  async handleCreateTransport(client: Socket, roomId: string) {
    const transport = await this.mediasoupService.createTransport(roomId);
    client.emit('transportCreated', { transport });
  }

  @SubscribeMessage('connectTransport')
  async handleConnectTransport(client: Socket, data: any) {
    await this.mediasoupService.connectTransport(
      data.roomId,
      data.transportId,
      data.dtlsParameters,
    );
    client.emit('transportConnected');
  }

  @SubscribeMessage('produce')
  async handleProduce(client: Socket, data: any) {
    const producer = await this.mediasoupService.produce(
      data.roomId,
      data.transportId,
      data.kind,
      data.rtpParameters,
    );
    client.emit('produced', { id: producer.id });
  }

  @SubscribeMessage('consume')
  async handleConsume(client: Socket, data: any) {
    const consumer = await this.mediasoupService.consume(
      data.roomId,
      data.transportId,
      data.producerId,
      data.rtpCapabilities,
    );
    client.emit('consumed', { id: consumer.id, producerId: data.producerId });
  }

  @SubscribeMessage('createDataProducer')
  async handleCreateDataProducer(client: Socket, data: any) {
    const dataProducer = await this.mediasoupService.createDataProducer(
      data.roomId,
      data.transportId,
      data.label,
      data.protocol,
    );
    client.emit('dataProducerCreated', { id: dataProducer.id });
  }

  @SubscribeMessage('createDataConsumer')
  async handleCreateDataConsumer(client: Socket, data: any) {
    const dataConsumer = await this.mediasoupService.createDataConsumer(
      data.roomId,
      data.transportId,
      data.dataProducerId,
    );
    client.emit('dataConsumerCreated', { id: dataConsumer.id });
  }
}
