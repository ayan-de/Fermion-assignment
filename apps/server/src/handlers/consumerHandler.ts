import { Socket } from "socket.io";
import {
  createConsumers,
  createConsumerForProducer,
  getAllProducers,
} from "../services/mediasoup";

/**
 * Handle consumer creation for all available producers
 * @param socket - Socket instance
 * @param data - Consumer data
 * @param callback - Callback function
 */
export const handleConsume = async (
  socket: Socket,
  data: { rtpCapabilities: any },
  callback: (result: any) => void
): Promise<void> => {
  try {
    const consumerInfos = await createConsumers(socket.id, data.rtpCapabilities);
    callback(consumerInfos);
  } catch (error) {
    console.error("Error in consume:", error);
    callback({ error: (error as Error).message });
  }
};

/**
 * Handle getting all available producers
 * @param socket - Socket instance
 * @param callback - Callback function
 */
export const handleGetProducers = async (
  socket: Socket,
  callback: (result: any) => void
): Promise<void> => {
  try {
    const producerList = getAllProducers(socket.id);
    callback(producerList);
  } catch (error) {
    console.error("Error in getProducers:", error);
    callback({ error: (error as Error).message });
  }
};

/**
 * Handle consuming a specific producer
 * @param socket - Socket instance
 * @param data - Consumer data
 * @param callback - Callback function
 */
export const handleConsumeProducer = async (
  socket: Socket,
  data: { producerId: string; rtpCapabilities: any },
  callback: (result: any) => void
): Promise<void> => {
  try {
    const consumerInfo = await createConsumerForProducer(
      socket.id,
      data.producerId,
      data.rtpCapabilities
    );
    callback(consumerInfo);
  } catch (error) {
    console.error("Error in consumeProducer:", error);
    callback({ error: (error as Error).message });
  }
}; 