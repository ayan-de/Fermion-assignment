import { Peer } from "../../types";

// Object to track connected users (socket.id as key)
const peers: Record<string, Peer> = {};

/**
 * Add a new peer
 * @param socketId - Socket ID of the peer
 */
export const addPeer = (socketId: string): void => {
  peers[socketId] = {
    producers: new Map(), // Will store producerId => producer
    consumers: new Map(), // Will store consumerId => consumer
  };
};

/**
 * Get a peer by socket ID
 * @param socketId - Socket ID of the peer
 * @returns Peer object or undefined
 */
export const getPeer = (socketId: string): Peer | undefined => {
  return peers[socketId];
};

/**
 * Get all peers
 * @returns Record of all peers
 */
export const getAllPeers = (): Record<string, Peer> => {
  return peers;
};

/**
 * Remove a peer
 * @param socketId - Socket ID of the peer to remove
 */
export const removePeer = (socketId: string): void => {
  delete peers[socketId];
};

/**
 * Check if a peer exists
 * @param socketId - Socket ID of the peer
 * @returns Whether the peer exists
 */
export const hasPeer = (socketId: string): boolean => {
  return socketId in peers;
}; 