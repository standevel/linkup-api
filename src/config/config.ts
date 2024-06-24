import { RtpCodecCapability } from 'mediasoup/node/lib/types';
import { availableParallelism, networkInterfaces } from 'os';

const getIPv4 = () => {
  const ifaces = networkInterfaces();
  for (const interfaceName in ifaces) {
    const iface = ifaces[interfaceName];
    for (const { address, family, internal } of iface) {
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return '0.0.0.0'; // Default to 0.0.0.0 if no external IPv4 address found
};

const IPv4 = getIPv4();
const numWorkers = availableParallelism();
console.log('cpus : ', numWorkers);
export const config = {
  server: {
    listen: {
      // app listen on
      ip: '0.0.0.0',
      port: process.env.PORT || 3000,
    },
    ssl: {
      // ssl/README.md
      cert: '../ssl/cert.pem',
      key: '../ssl/key.pem',
    },
  },
  listenIp: '0.0.0.0',
  listenPort: 3016,

  mediasoup: {
    numWorkers: numWorkers,
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'debug',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },
    router: {
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
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ] as RtpCodecCapability[],
    },

    webRtcServerActive: false,
    webRtcServerOptions: {
      listenInfos: [
        // { protocol: 'udp', ip: '0.0.0.0', announcedAddress: IPv4, port: 40000 },
        // { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: IPv4, port: 40000 },
        {
          protocol: 'udp',
          ip: '0.0.0.0',
          announcedAddress: IPv4,
          portRange: { min: 40000, max: 40000 + numWorkers },
        },
        {
          protocol: 'tcp',
          ip: '0.0.0.0',
          announcedAddress: IPv4,
          portRange: { min: 40000, max: 40000 + numWorkers },
        },
      ],
    },
    // WebRtcTransportOptions
    webRtcTransport: {
      listenInfos: [
        // { protocol: 'udp', ip: IPv4, portRange: { min: 40000, max: 40100 } },
        // { protocol: 'tcp', ip: IPv4, portRange: { min: 40000, max: 40100 } },
        {
          protocol: 'udp',
          ip: '0.0.0.0',
          announcedAddress: IPv4,
          portRange: { min: 40000, max: 40100 },
        },
        {
          protocol: 'tcp',
          ip: '0.0.0.0',
          announcedAddress: IPv4,
          portRange: { min: 40000, max: 40100 },
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
      maxIncomingBitrate: 1500000,
    },
  },
};
