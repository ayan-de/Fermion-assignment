import { getPeer, getAllPeers } from "./peerManager";
import { stopHlsTranscoding, getActiveStreams } from "../ffmpeg";
import { HlsStreamInfo } from "../../types";

// Object to track HLS streams
const hlsStreams: Record<string, any> = {};

/**
 * Add an HLS stream
 * @param producerId - Producer ID
 * @param hlsStream - HLS stream object
 */
export const addHlsStream = (producerId: string, hlsStream: any): void => {
  hlsStreams[producerId] = hlsStream;
};

/**
 * Get HLS stream for a producer
 * @param producerId - Producer ID
 * @returns HLS stream object or undefined
 */
export const getHlsStream = (producerId: string): any => {
  return hlsStreams[producerId];
};

/**
 * Remove HLS stream for a producer
 * @param producerId - Producer ID
 */
export const removeHlsStream = (producerId: string): void => {
  const hlsStream = hlsStreams[producerId];
  if (hlsStream) {
    stopHlsTranscoding(hlsStream);
    delete hlsStreams[producerId];
  }
};

/**
 * Get all available HLS streams
 * @returns Array of HLS stream information
 */
export const getAvailableHlsStreams = (): HlsStreamInfo[] => {
  const availableStreams: HlsStreamInfo[] = [];
  const peers = getAllPeers();

  for (const [producerId, hlsStream] of Object.entries(hlsStreams)) {
    // Check if the stream is still active by looking for the producer
    let isActive = false;
    for (const [peerId, peer] of Object.entries(peers)) {
      if (peer.producers && peer.producers.has(producerId)) {
        isActive = true;
        break;
      }
    }

    availableStreams.push({
      id: producerId,
      url: `http://localhost:4000${hlsStream.playlistUrl}`,
      name: `Stream ${producerId}`,
      isActive: isActive,
    });
  }

  return availableStreams;
};

/**
 * Get HLS stream URL for a specific producer
 * @param producerId - Producer ID
 * @returns HLS stream URL or error
 */
export const getHlsStreamUrl = (producerId: string): { url?: string; error?: string } => {
  const hlsStream = hlsStreams[producerId];
  if (hlsStream) {
    return { url: hlsStream.playlistUrl };
  } else {
    return { error: "HLS stream not found for this producer" };
  }
};

/**
 * Clean up all HLS streams for a peer
 * @param socketId - Socket ID of the peer
 */
export const cleanupPeerHlsStreams = (socketId: string): void => {
  const peer = getPeer(socketId);
  if (peer && peer.hlsStreams) {
    for (const producerId in peer.hlsStreams) {
      removeHlsStream(producerId);
    }
  }
}; 