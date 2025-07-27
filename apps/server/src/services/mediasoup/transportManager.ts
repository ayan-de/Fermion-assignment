import * as mediasoup from "mediasoup";
import { getRouter } from "./router";
import { getPeer } from "./peerManager";
import { TransportOptions } from "../../types";

/**
 * Create a WebRTC transport for producing media
 * @param socketId - Socket ID of the peer
 * @returns Transport options for the client
 */
export const createProducerTransport = async (
  socketId: string
): Promise<TransportOptions> => {
  const peer = getPeer(socketId);
  if (!peer) {
    throw new Error(`Peer ${socketId} not found`);
  }

  // Prevent duplicate producer transport
  if (peer.producerTransport) {
    throw new Error("Producer transport already exists");
  }

  const router = getRouter();
  
  // mediasoup router creating a transport to send to client
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: "127.0.0.1", announcedIp: undefined }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transport.on("dtlsstatechange", (state) => {
    if (state === "closed") {
      transport.close();
    }
  });

  // Save it for this peer
  peer.producerTransport = transport;

  // sending back to client everything it needs to connect
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
};

/**
 * Create a WebRTC transport for consuming media
 * @param socketId - Socket ID of the peer
 * @returns Transport options for the client
 */
export const createConsumerTransport = async (
  socketId: string
): Promise<TransportOptions> => {
  const peer = getPeer(socketId);
  if (!peer) {
    throw new Error(`Peer ${socketId} not found`);
  }

  const router = getRouter();
  
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: "127.0.0.1", announcedIp: undefined }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  peer.consumerTransport = transport;

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
};

/**
 * Connect a producer transport
 * @param socketId - Socket ID of the peer
 * @param dtlsParameters - DTLS parameters from the client
 */
export const connectProducerTransport = async (
  socketId: string,
  dtlsParameters: any
): Promise<void> => {
  const peer = getPeer(socketId);
  if (!peer || !peer.producerTransport) {
    throw new Error(`Producer transport not found for peer ${socketId}`);
  }

  await peer.producerTransport.connect({ dtlsParameters });
};

/**
 * Connect a consumer transport
 * @param socketId - Socket ID of the peer
 * @param dtlsParameters - DTLS parameters from the client
 */
export const connectConsumerTransport = async (
  socketId: string,
  dtlsParameters: any
): Promise<void> => {
  const peer = getPeer(socketId);
  if (!peer || !peer.consumerTransport) {
    throw new Error(`Consumer transport not found for peer ${socketId}`);
  }

  await peer.consumerTransport.connect({ dtlsParameters });
}; 