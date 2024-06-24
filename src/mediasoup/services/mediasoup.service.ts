import { Injectable, Logger } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { RtpCapabilities } from 'mediasoup/node/lib/RtpParameters';
import { RtpParameters } from 'mediasoup/node/lib/fbs/rtp-parameters';
import {
  Router,
  WebRtcTransport,
  Worker,
  WorkerLogLevel,
  WorkerLogTag,
} from 'mediasoup/node/lib/types';
import { config } from 'src/config/config';

@Injectable()
export class MediasoupService {
  nextMediasoupWorkerIdx = 0;
  private workers: Array<Worker> = [];
  private worker: Worker;
  private rooms: Map<string, any> = new Map();

  webRtcServerActive = config.mediasoup.webRtcServerActive;

  // ip (server local IPv4)
  IPv4 = this.webRtcServerActive
    ? config.mediasoup.webRtcServerOptions.listenInfos[0].ip
    : config.mediasoup.webRtcTransport.listenInfos[0].ip;

  // announcedAddress (server public IPv4)
  announcedAddress = this.webRtcServerActive
    ? config.mediasoup.webRtcServerOptions.listenInfos[0].announcedAddress
    : config.mediasoup.webRtcTransport.listenInfos[0].announcedAddress;

  constructor() {
    this.initializeWorkers();
  }

  async resumeConsumer(consumerId: any, roomId: any) {
    const room = this.getRoom(roomId);
    const consumer = room.consumers.get(consumerId);
    console.log('consumer to resume: ', consumer);
    await consumer.resume();
    return { message: 'consumer successfully resumed' };
  }

  async geExistingRoomProducers(roomId: string, userProducerId: string) {
    try {
      const room = this.getRoom(roomId);
      console.log('user producer id: ', userProducerId);
      const producersMap: Map<string, any> = room.producers;
      console.log('filtered producers: ', producersMap);
      const producers = [...producersMap.values()].filter(
        (producer) => producer.id != userProducerId,
      );
      console.log('Producers: ', producers);
      return producers;

    } catch (error) {
      console.log('Error getting existing producers: ', error);
    }
  }
  clone(value) {
    if (value === undefined) return undefined;
    if (Number.isNaN(value)) return NaN;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
  private async initializeWorkers() {
    Logger.log('initializing worker');
    for (let i = 0; i < config.mediasoup.numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel as WorkerLogLevel,
        logTags: config.mediasoup.worker.logTags as WorkerLogTag[],
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
      });
      Logger.log('worker created [pid:d]', worker.pid);
      worker.on('died', () => {
        Logger.error(
          'mediasoup worker died, exting in 2 seconds ... [pid:d]',
          worker.pid,
        );
        setTimeout(() => {
          process.exit(1);
        }, 2000);
      });
      if (this.webRtcServerActive) {
        const webRtcServerOptions = this.clone(
          config.mediasoup.webRtcServerOptions,
        );
        const portIncrement = i;

        for (const listenInfo of webRtcServerOptions.listenInfos) {
          if (!listenInfo.portRange) {
            listenInfo.port += portIncrement;
          }
        }

        Logger.log('Create a WebRtcServer', {
          worker_pid: worker.pid,
          webRtcServerOptions: webRtcServerOptions,
        });

        const webRtcServer =
          await worker.createWebRtcServer(webRtcServerOptions);
        worker.appData.webRtcServer = webRtcServer;
      }
      this.workers.push(worker);
    }
  }
  async getRoomRouter(roomId: string) {
    const room = this.getRoom(roomId);
    return room.router;
  }
  getMediasoupWorker() {
    const worker = this.workers[this.nextMediasoupWorkerIdx];
    if (++this.nextMediasoupWorkerIdx === this.workers.length)
      this.nextMediasoupWorkerIdx = 0;
    return worker;
  }
  public async createRoom(roomId: string) {
    Logger.log('about to create room: ', roomId);
    if (this.rooms.has(roomId)) return this.rooms.get(roomId);
    const worker = this.getMediasoupWorker();
    Logger.log('worker id for room: ', roomId, worker.pid);
    const router: Router = await worker.createRouter({
      mediaCodecs: config.mediasoup.router.mediaCodecs,
    });
    Logger.log('room router: ', router.id);
    const room = {
      worker,
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
    try {
      const room = this.getRoom(roomId);
      if (!room) throw new Error(`Room ${roomId} not found`);
      const {
        initialAvailableOutgoingBitrate,
        maxIncomingBitrate,
        listenInfos,
      } = config.mediasoup.webRtcTransport;
      const transport: WebRtcTransport =
        await room.router.createWebRtcTransport({
          ...(this.webRtcServerActive
            ? { webRtcServer: room.worker.webRtcServer }
            : { listenInfos: listenInfos }),

          listenInfos: config.mediasoup.webRtcTransport.listenInfos,
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          iceConsentTimeout: 20,
          initialAvailableOutgoingBitrate,
        });

      if (maxIncomingBitrate) {
        try {
          await transport.setMaxIncomingBitrate(maxIncomingBitrate);
        } catch (error) {
          Logger.error('Error: ', error);
        }
      }
      room.transports.set(transport.id, transport);
      const { id, iceParameters, iceCandidates, dtlsParameters } = transport;
      // Logger.log('id, iceParameters', id, iceParameters);
      transport.on('icestatechange', (iceState) => {
        if (iceState === 'disconnected' || iceState === 'closed') {
          Logger.debug('Transport closed "icestatechange" event', {
            // peer_name: peer_name,
            transport_id: id,
            iceState: iceState,
          });
          transport.close();
        }
      });

      transport.on('sctpstatechange', (sctpState) => {
        Logger.debug('Transport "sctpstatechange" event', {
          // conslepeer_name: peer_name,
          transport_id: id,
          sctpState: sctpState,
        });
      });

      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'failed' || dtlsState === 'closed') {
          Logger.debug('Transport closed "dtlsstatechange" event', {
            // peer_name: peer_name,
            transport_id: id,
            dtlsState: dtlsState,
          });
          transport.close();
        }
      });

      transport.on('@close', () => {
        Logger.debug('Transport closed', {
          // peer_name: peer_name,
          transport_id: transport.id,
          iceRole: transport.iceRole
        });
      });

      return {
        id: id,
        iceParameters: iceParameters,
        iceCandidates: iceCandidates,
        dtlsParameters: dtlsParameters,
      };
    } catch (error) {
      Logger.error('Error creating transport: ', error);
    }
  }

  public async connectTransport(
    roomId: string,
    transportId: string,
    dtlsParameters: any,
  ) {
    try {
      const room = this.getRoom(roomId);
      if (!room) throw new Error(`Room ${roomId} not found`);
      Logger.log('room transports: ', room.transports);
      Logger.log('transport id: ', transportId);
      const transport = room.transports.get(transportId);
      if (!transport) throw new Error(`Transport ${transportId} not found`);

      await transport.connect({ dtlsParameters });
      Logger.log('transport connected: ', transport.id);
    } catch (error) {
      Logger.error('connect transport error: ', error);
    }
  }

  public async produce(
    roomId: string,
    transportId: string,
    kind: string,
    rtpParameters: RtpParameters,
  ) {
    try {
      const room = this.getRoom(roomId);
      if (!room) throw new Error(`Room ${roomId} not found`);

      const transport = room.transports.get(transportId);
      if (!transport) throw new Error(`Transport ${transportId} not found`);

      const producer = await transport.produce({ kind, rtpParameters });
      room.producers.set(producer.id, producer);
      console.log('room producers: ', room.producers);
      return producer;
    } catch (error) {
      Logger.error('producing error: ', error);
    }
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
    Logger.log('room consumers: ', room.consumers);
    consumer.on('producerclose', () => {
      Logger.debug('Consumer closed due to "producerclose" event');

      // peer.removeConsumer(id);

      // Notify the client that consumer is closed
      // this.send(socket_id, 'consumerClosed', {
      //   consumer_id: id,
      //   consumer_kind: kind,
      // });
    });
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
