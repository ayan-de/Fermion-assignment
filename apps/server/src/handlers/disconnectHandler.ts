import { Socket } from "socket.io";
import { getPeer, removePeer } from "../services/mediasoup";
import { cleanupPeerHlsStreams } from "../services/mediasoup";

/**
 * Handle socket disconnection
 * @param socket - Socket instance
 */
export const handleDisconnect = (socket: Socket): void => {
  console.log(`Client disconnected: ${socket.id}`);

  const peer = getPeer(socket.id);
  if (!peer) return;

  // Stop HLS transcoding for all producers of this peer
  cleanupPeerHlsStreams(socket.id);

  // Close all producers
  if (peer.producers) {
    for (const producer of peer.producers.values()) {
      producer.close();
    }
  }

  // Close all consumers
  if (peer.consumers) {
    for (const consumer of peer.consumers.values()) {
      consumer.close();
    }
  }

  // Close transports
  if (peer.producerTransport) {
    peer.producerTransport.close();
  }

  if (peer.consumerTransport) {
    peer.consumerTransport.close();
  }

  // Remove the peer
  removePeer(socket.id);

  // Notify other clients that this peer disconnected
  socket.broadcast.emit("peerDisconnected", { socketId: socket.id });
}; 