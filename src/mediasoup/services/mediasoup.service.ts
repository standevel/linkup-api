import { Injectable } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { RtpCapabilities } from 'mediasoup/node/lib/RtpParameters';
import { RtpParameters } from 'mediasoup/node/lib/fbs/rtp-parameters';
import { Router, WebRtcTransport } from 'mediasoup/node/lib/types';

@Injectable()
export class MediasoupService {
  private worker: mediasoup.types.Worker;
  private rooms: Map<string, any> = new Map();

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    this.worker = await mediasoup.createWorker();
    this.worker.on('died', () => {
      console.error('Mediasoup worker has died');
      // Handle worker restart logic
    });
  }

  public async createRoom(roomId: string) {
    if (this.rooms.has(roomId)) return this.rooms.get(roomId);

    const router: Router = await this.worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
        },
      ],
    });
    const room = {
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  public getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  public async createTransport(roomId: string) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const transport: WebRtcTransport = await room.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: '192.168.0.121' }],
      enableUdp: true,
      enableTcp: true,
    });

    room.transports.set(transport.id, transport);

    return transport;
  }

  public async connectTransport(
    roomId: string,
    transportId: string,
    dtlsParameters: any,
  ) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const transport = room.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);

    await transport.connect({ dtlsParameters });
  }

  public async produce(
    roomId: string,
    transportId: string,
    kind: string,
    rtpParameters: RtpParameters,
  ) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const transport = room.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);

    const producer = await transport.produce({ kind, rtpParameters });
    room.producers.set(producer.id, producer);
    return producer;
  }

  public async consume(
    roomId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const router = room.router;
    if (!router.canConsume({ producerId, rtpCapabilities }))
      throw new Error('Cannot consume');

    const transport = room.transports.get(transportId);
    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    room.consumers.set(consumer.id, consumer);
    return consumer;
  }

  public async createDataConsumer(
    roomId: string,
    transportId: string,
    dataProducerId: string,
  ) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const transport = room.transports.get(transportId);
    const dataConsumer = await transport.consumeData({
      dataProducerId,
    });

    return dataConsumer;
  }

  public async createDataProducer(
    roomId: string,
    transportId: string,
    label: string,
    protocol: string,
  ) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const transport = room.transports.get(transportId);
    const dataProducer = await transport.produceData({
      label,
      protocol,
    });

    return dataProducer;
  }
}
