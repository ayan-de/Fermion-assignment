import { Socket } from "socket.io";
import { addPeer } from "../services/mediasoup";

/**
 * Handle new socket connection
 * @param socket - Socket instance
 */
export const handleConnection = (socket: Socket): void => {
  console.log(`Client connected: ${socket.id}`);
  
  // When a user connects, they're assigned a socket.id and added to the peers object.
  addPeer(socket.id);
}; 