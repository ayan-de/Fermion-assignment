import * as mediasoup from "mediasoup";
import { getPeer, getAllPeers } from "./peerManager";
import { getRouter } from "./router";
import { startHlsTranscoding } from "../ffmpeg";
import { HlsStream } from "../../types";

/**
 * Create a producer for a peer
 * @param socketId - Socket ID of the peer
 * @param kind - Media kind ('audio' or 'video')
 * @param rtpParameters - RTP parameters from the client
 * @returns Producer information
 */
export const createProducer = async (
  socketId: string,
  kind: mediasoup.types.MediaKind,
  rtpParameters: any
): Promise<{ id: string; hlsStream?: HlsStream }> => {
  const peer = getPeer(socketId);
  if (!peer || !peer.producerTransport) {
    throw new Error(`Producer transport not found for peer ${socketId}`);
  }

  const transport = peer.producerTransport;
  const producer = await transport.produce({ kind, rtpParameters });

  // Store the producer in the peer's producers map
  peer.producers.set(producer.id, producer);

  let hlsStream: HlsStream | undefined = undefined;

  // Start HLS transcoding for video producers
  if (kind === "video") {
    try {
      // Create a unique stream ID based on socket ID and producer ID
      const streamId = `${socketId}_${producer.id}`;
      console.log(`Starting HLS transcoding for stream ${streamId}`);

      const router = getRouter();
      
      // Start FFmpeg process for HLS transcoding
      hlsStream = await startHlsTranscoding(
        producer,
        streamId,
        router
      );

      // Add HLS stream info to the peer
      if (!peer.hlsStreams) {
        peer.hlsStreams = {};
      }
      peer.hlsStreams[producer.id] = hlsStream;

      console.log(`HLS stream available at: ${hlsStream.playlistUrl}`);
    } catch (hlsError) {
      console.error(
        `Error starting HLS transcoding for producer ${producer.id}:`,
        hlsError
      );
      // Continue even if HLS transcoding fails
    }
  }

  console.log(
    `Producer created for ${socketId}, kind: ${kind}, id: ${producer.id}`
  );

  return { id: producer.id, hlsStream };
};

/**
 * Get all producers from all peers except the specified peer
 * @param excludeSocketId - Socket ID to exclude
 * @returns Array of producer information
 */
export const getAllProducers = (excludeSocketId: string): Array<{
  producerId: string;
  peerId: string;
  kind: string;
}> => {
  const producerList: Array<{
    producerId: string;
    peerId: string;
    kind: string;
  }> = [];

  const peers = getAllPeers();

  // Iterate through all peers except self
  for (const [peerId, peer] of Object.entries(peers)) {
    if (peerId === excludeSocketId) continue;

    // For each producer of this peer
    if (peer.producers) {
      for (const [producerId, producer] of peer.producers) {
        producerList.push({
          producerId,
          peerId,
          kind: producer.kind,
        });
      }
    }
  }

  return producerList;
}; 