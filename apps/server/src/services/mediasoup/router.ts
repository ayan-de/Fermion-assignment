import * as mediasoup from "mediasoup";

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;

/**
 * Initialize MediaSoup worker and router
 */
export const initializeMediasoup = async (): Promise<{
  worker: mediasoup.types.Worker;
  router: mediasoup.types.Router;
}> => {
  // Step-1 worker: Background thread for RTP/DTLS etc
  // Creating a worker, which is a background thread in Mediasoup
  // that handles heavy media processing
  worker = await mediasoup.createWorker();

  // Step-2 router: For audio/video routing and codec negotiation
  // setting up which media codecs the server supports
  // this handles forwarding streams between clients
  // this is the codec the server will accept
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {},
      },
    ],
  });

  return { worker, router };
};

/**
 * Get the router instance
 */
export const getRouter = (): mediasoup.types.Router => {
  if (!router) {
    throw new Error("Router not initialized. Call initializeMediasoup() first.");
  }
  return router;
};

/**
 * Get the worker instance
 */
export const getWorker = (): mediasoup.types.Worker => {
  if (!worker) {
    throw new Error("Worker not initialized. Call initializeMediasoup() first.");
  }
  return worker;
}; 