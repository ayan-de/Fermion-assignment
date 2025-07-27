import { Socket } from "socket.io";
import {
  createProducerTransport,
  createConsumerTransport,
  connectProducerTransport,
  connectConsumerTransport,
  getRouter,
} from "../services/mediasoup";

/**
 * Handle router RTP capabilities request
 * @param socket - Socket instance
 * @param callback - Callback function
 */
export const handleGetRouterRtpCapabilities = (
  socket: Socket,
  callback: (capabilities: any) => void
): void => {
  const router = getRouter();
  callback(router.rtpCapabilities);
};

/**
 * Handle producer transport creation
 * @param socket - Socket instance
 * @param callback - Callback function
 */
export const handleCreateWebRtcTransport = async (
  socket: Socket,
  callback: (result: any) => void
): Promise<void> => {
  try {
    const transportOptions = await createProducerTransport(socket.id);
    callback(transportOptions);
  } catch (err) {
    console.error(err);
    callback({ error: (err as Error).message });
  }
};

/**
 * Handle producer transport connection
 * @param socket - Socket instance
 * @param data - Transport connection data
 * @param callback - Callback function
 */
export const handleConnectTransport = async (
  socket: Socket,
  data: { dtlsParameters: any },
  callback: (result: string) => void
): Promise<void> => {
  try {
    await connectProducerTransport(socket.id, data.dtlsParameters);
    callback("connected");
  } catch (error) {
    console.error("Error connecting transport:", error);
    callback("error");
  }
};

/**
 * Handle consumer transport creation
 * @param socket - Socket instance
 * @param callback - Callback function
 */
export const handleCreateConsumerTransport = async (
  socket: Socket,
  callback: (result: any) => void
): Promise<void> => {
  try {
    const transportOptions = await createConsumerTransport(socket.id);
    callback(transportOptions);
  } catch (err) {
    console.error("createConsumerTransport failed", err);
    callback({ error: (err as Error).message });
  }
};

/**
 * Handle consumer transport connection
 * @param socket - Socket instance
 * @param data - Transport connection data
 * @param callback - Callback function
 */
export const handleConnectConsumerTransport = async (
  socket: Socket,
  data: { dtlsParameters: any },
  callback: (result: string) => void
): Promise<void> => {
  try {
    await connectConsumerTransport(socket.id, data.dtlsParameters);
    callback("connected");
  } catch (error) {
    console.error("Error connecting consumer transport:", error);
    callback("error");
  }
}; 