import { Socket } from "socket.io";
import { createProducer } from "../services/mediasoup";
import { addHlsStream } from "../services/mediasoup";

/**
 * Handle media producer creation
 * @param socket - Socket instance
 * @param data - Producer data
 * @param callback - Callback function
 */
export const handleProduce = async (
  socket: Socket,
  data: { kind: "audio" | "video"; rtpParameters: any },
  callback: (result: any) => void
): Promise<void> => {
  try {
    const { id: producerId, hlsStream } = await createProducer(
      socket.id,
      data.kind,
      data.rtpParameters
    );

    // Store HLS stream if created
    if (hlsStream) {
      addHlsStream(producerId, hlsStream);
    }

    // Notify all other clients about the new producer
    socket.broadcast.emit("newProducer", {
      socketId: socket.id,
      producerId: producerId,
      kind: data.kind,
    });

    callback({ id: producerId });
  } catch (error) {
    console.error("Error in produce:", error);
    callback({ error: (error as Error).message });
  }
}; 