import * as mediasoup from "mediasoup";
import { getPeer, getAllPeers } from "./peerManager";
import { getRouter } from "./router";
import { ConsumerInfo } from "../../types";

/**
 * Create consumers for all available producers
 * @param socketId - Socket ID of the peer
 * @param rtpCapabilities - RTP capabilities of the client
 * @returns Array of consumer information
 */
export const createConsumers = async (
  socketId: string,
  rtpCapabilities: any
): Promise<ConsumerInfo[]> => {
  // If the client doesn't have RTP capabilities, we can't create consumers
  if (!rtpCapabilities) {
    throw new Error("No RTP capabilities provided");
  }

  const peer = getPeer(socketId);
  if (!peer || !peer.consumerTransport) {
    throw new Error("No consumer transport found");
  }

  const consumerTransport = peer.consumerTransport;
  const router = getRouter();
  const peers = getAllPeers();

  const consumerInfos: ConsumerInfo[] = [];

  // Iterate through all peers
  for (const [peerId, peerData] of Object.entries(peers)) {
    // Skip own streams
    if (peerId === socketId) continue;

    // Check if this peer has any producers
    if (!peerData.producers || peerData.producers.size === 0) continue;

    // For each producer of this peer
    for (const [producerId, producer] of peerData.producers) {
      // Check if we can consume this producer
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        console.log(
          `Cannot consume producer ${producerId} with client's RTP capabilities`
        );
        continue;
      }

      try {
        // Create a consumer for this producer
        const consumer = await consumerTransport.consume({
          producerId,
          rtpCapabilities,
          paused: false,
        });

        // Store the consumer
        peer.consumers.set(consumer.id, consumer);

        // Add to the list of consumer info to send back to client
        consumerInfos.push({
          id: consumer.id,
          producerId: producer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          peerId: peerId,
        });

        console.log(
          `Created consumer ${consumer.id} for producer ${producerId} (peer ${peerId})`
        );
      } catch (error) {
        console.error(
          `Error creating consumer for producer ${producerId}:`,
          error
        );
      }
    }
  }

  return consumerInfos;
};

/**
 * Create a consumer for a specific producer
 * @param socketId - Socket ID of the peer
 * @param producerId - Producer ID to consume
 * @param rtpCapabilities - RTP capabilities of the client
 * @returns Consumer information
 */
export const createConsumerForProducer = async (
  socketId: string,
  producerId: string,
  rtpCapabilities: any
): Promise<ConsumerInfo> => {
  // Check if we have the consumer transport
  const peer = getPeer(socketId);
  if (!peer || !peer.consumerTransport) {
    throw new Error("No consumer transport found");
  }

  const router = getRouter();
  const peers = getAllPeers();

  // Find the producer in any peer
  let producer: mediasoup.types.Producer | null = null;
  let producerPeerId: string | null = null;

  for (const [peerId, peerData] of Object.entries(peers)) {
    if (peerData.producers && peerData.producers.has(producerId)) {
      producer = peerData.producers.get(producerId)!;
      producerPeerId = peerId;
      break;
    }
  }

  if (!producer) {
    throw new Error(`Producer ${producerId} not found`);
  }

  // Check if the router can consume this producer with the client's RTP capabilities
  if (!router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error(
      `Cannot consume producer ${producerId} with the provided RTP capabilities`
    );
  }

  // Create a consumer
  const consumer = await peer.consumerTransport!.consume({
    producerId,
    rtpCapabilities,
    paused: false,
  });

  // Store the consumer
  peer.consumers.set(consumer.id, consumer);

  console.log(
    `Created consumer ${consumer.id} for producer ${producerId} (peer ${producerPeerId})`
  );

  // Return the consumer parameters
  return {
    id: consumer.id,
    producerId: producer.id,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    peerId: producerPeerId!,
  };
}; 