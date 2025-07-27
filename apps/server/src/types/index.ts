import * as mediasoup from "mediasoup";

export interface Peer {
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
  producerTransport?: mediasoup.types.WebRtcTransport;
  consumerTransport?: mediasoup.types.WebRtcTransport;
  hlsStreams?: Record<string, HlsStream>;
}

export interface HlsStream {
  process: any;
  streamId: string;
  outputDir: string;
  playlistUrl: string;
  rtpPort: number;
  consumer: mediasoup.types.Consumer;
  plainTransport: mediasoup.types.PlainTransport;
}

export interface ProducerInfo {
  producerId: string;
  peerId: string;
  kind: string;
}

export interface ConsumerInfo {
  id: string;
  producerId: string;
  kind: string;
  rtpParameters: any;
  peerId: string;
}

export interface HlsStreamInfo {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
}

export interface TransportOptions {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
} 