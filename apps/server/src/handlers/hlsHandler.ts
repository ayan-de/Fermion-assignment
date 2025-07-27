import { Socket } from "socket.io";
import {
  getHlsStreamUrl,
  getAvailableHlsStreams,
} from "../services/mediasoup";
import { getActiveStreams } from "../services/ffmpeg";

/**
 * Handle getting HLS stream URL for a specific producer
 * @param socket - Socket instance
 * @param data - Request data
 * @param callback - Callback function
 */
export const handleGetHlsStreamUrl = (
  socket: Socket,
  data: { producerId: string },
  callback: (result: any) => void
): void => {
  try {
    const result = getHlsStreamUrl(data.producerId);
    callback(result);
  } catch (error) {
    console.error("Error in getHlsStreamUrl:", error);
    callback({ error: (error as Error).message });
  }
};

/**
 * Handle getting all available HLS streams
 * @param socket - Socket instance
 * @param callback - Callback function
 */
export const handleGetAvailableHlsStreams = (
  socket: Socket,
  callback: (result: any) => void
): void => {
  try {
    const availableStreams = getAvailableHlsStreams();
    callback({ streams: availableStreams });
  } catch (error) {
    console.error("Error in getAvailableHlsStreams:", error);
    callback({ error: (error as Error).message });
  }
};

/**
 * Notify about new HLS stream
 * @param socket - Socket instance
 * @param producerId - Producer ID
 * @param hlsStream - HLS stream object
 */
export const notifyNewHlsStream = (
  socket: Socket,
  producerId: string,
  hlsStream: any
): void => {
  socket.emit("newHlsStream", {
    id: producerId,
    url: `http://localhost:4000${hlsStream.playlistUrl}`,
    name: `Stream ${producerId}`,
    isActive: true,
  });

  // Log active streams count
  const activeStreams = getActiveStreams();
  console.log(
    `Active HLS streams: ${
      activeStreams.length
    } - ${activeStreams.join(", ")}`
  );
}; 