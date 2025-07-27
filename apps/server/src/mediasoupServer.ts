// Mediasoup router, transport, producer/consumer setup
import { Server as SocketIOServer } from "socket.io";
import { initializeMediasoup } from "./services/mediasoup";
import {
  handleConnection,
  handleDisconnect,
  handleGetRouterRtpCapabilities,
  handleCreateWebRtcTransport,
  handleConnectTransport,
  handleCreateConsumerTransport,
  handleConnectConsumerTransport,
  handleProduce,
  handleConsume,
  handleGetProducers,
  handleConsumeProducer,
  handleGetHlsStreamUrl,
  handleGetAvailableHlsStreams,
  notifyNewHlsStream,
} from "./handlers";

export default async function (io: SocketIOServer): Promise<void> {
  // Initialize MediaSoup worker and router
  await initializeMediasoup();

  // Events for peer connection
  io.on("connection", (socket) => {
    // Handle new connection
    handleConnection(socket);

    // Step-3 Get RTP Capabilities
    socket.on("getRouterRtpCapabilities", (_, callback) => {
      handleGetRouterRtpCapabilities(socket, callback);
    });

    // Step-4 Create producer transport
    socket.on("createWebRtcTransport", async (_, callback) => {
      await handleCreateWebRtcTransport(socket, callback);
    });

    // DTLS Handshake for producer
    socket.on("connectTransport", async ({ dtlsParameters }, callback) => {
      await handleConnectTransport(socket, { dtlsParameters }, callback);
    });

    // Step-5 Create producer
    socket.on("produce", async ({ kind, rtpParameters }, callback) => {
      await handleProduce(socket, { kind, rtpParameters }, callback);
    });

    // Get HLS stream URL for a specific producer
    socket.on("getHlsStreamUrl", ({ producerId }, callback) => {
      handleGetHlsStreamUrl(socket, { producerId }, callback);
    });

    // Get all available HLS streams
    socket.on("getAvailableHlsStreams", (_, callback) => {
      handleGetAvailableHlsStreams(socket, callback);
    });

    // Create consumer transport
    socket.on("createConsumerTransport", async (_, callback) => {
      await handleCreateConsumerTransport(socket, callback);
    });

    // DTLS handshake for consumer
    socket.on("connectConsumerTransport", async ({ dtlsParameters }, callback) => {
      await handleConnectConsumerTransport(socket, { dtlsParameters }, callback);
    });

    // Step-6 Create consumers
    socket.on("consume", async ({ rtpCapabilities }, callback) => {
      await handleConsume(socket, { rtpCapabilities }, callback);
    });

    // Get all producers
    socket.on("getProducers", async (_, callback) => {
      await handleGetProducers(socket, callback);
    });

    // Consume a specific producer
    socket.on("consumeProducer", async ({ producerId, rtpCapabilities }, callback) => {
      await handleConsumeProducer(socket, { producerId, rtpCapabilities }, callback);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      handleDisconnect(socket);
    });
  });
} 