//Mediasoup router, transport, producer/consumer setup
const mediasoup = require("mediasoup");
const { startHlsTranscoding, stopHlsTranscoding } = require("./ffmpeg");

//A Mediasoup worker is a background thread that handles all media traffic
let worker;
//Handles RTP capabilities and media routing between transports
let router;
// Object to track connected users (socket.id as key)
let peers = {};
// Object to track HLS streams
let hlsStreams = {};

module.exports = async function (io) {
  //step-1 worker: Background thread for RTP/DTLS etc
  //Creating a worker, which is a background thread in Mediasoup
  // that handles heavy media processing
  worker = await mediasoup.createWorker();

  //Step-2 router: For audio/video routing and codec negotiation
  //setting up which media codecs the server supports
  //this handles forwarding streams between clients
  //this is the codec the server will accept
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

  //events for peer connection
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    //When a user connects, they're assigned a socket.id and added to the peers object.
    peers[socket.id] = {
      producers: new Map(), // Will store producerId => producer
      consumers: new Map(), // Will store consumerId => consumer
    };

    //step-3  Get RTP Capabilities
    //This allows the frontend to fetch the RTP capabilities of your Mediasoup router (required before creating transports)
    socket.on("getRouterRtpCapabilities", (_, callback) => {
      callback(router.rtpCapabilities);
    });

    //step-4 This transport allows the client to send media (camera/mic) to the server.
    socket.on("createWebRtcTransport", async (_, callback) => {
      try {
        //  Prevent duplicate producer transport
        if (peers[socket.id].producerTransport) {
          console.log(`Producer transport already exists for ${socket.id}`);
          return callback({
            error: "Producer transport already exists",
          });
        }
        //mediasoup router creating a transport to send to clinent
        const transport = await router.createWebRtcTransport({
          listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });

        transport.on("dtlsstatechange", (state) => {
          if (state === "closed") {
            transport.close();
          }
        });

        // No need to store in a separate array since we're storing in the peers object
        // Save it for this peer
        peers[socket.id].producerTransport = transport;

        //sending back to client everything it needs to connect
        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    });

    //DTLS Handshake
    socket.on("connectTransport", async ({ dtlsParameters }, callback) => {
      await peers[socket.id].producerTransport.connect({ dtlsParameters });
      callback("connected");
    });

    //step-5 producer: A peer that sends media (camera/mic) from client to mediasoup
    socket.on("produce", async ({ kind, rtpParameters }, callback) => {
      try {
        const transport = peers[socket.id].producerTransport;
        const producer = await transport.produce({ kind, rtpParameters });

        // Store the producer in the peer's producers map
        peers[socket.id].producers.set(producer.id, producer);

        // Start HLS transcoding for video producers
        if (kind === "video") {
          try {
            // Create a unique stream ID based on socket ID and producer ID
            const streamId = `${socket.id}_${producer.id}`;
            console.log(`Starting HLS transcoding for stream ${streamId}`);

            // Start FFmpeg process for HLS transcoding
            const hlsStream = await startHlsTranscoding(
              producer,
              streamId,
              router
            );

            // Store the HLS stream info
            hlsStreams[producer.id] = hlsStream;

            // Add HLS stream info to the peer
            if (!peers[socket.id].hlsStreams) {
              peers[socket.id].hlsStreams = {};
            }
            peers[socket.id].hlsStreams[producer.id] = hlsStream;

            console.log(`HLS stream available at: ${hlsStream.playlistUrl}`);

            // Notify all clients about the new HLS stream
            io.emit("newHlsStream", {
              id: producer.id,
              url: `http://localhost:4000${hlsStream.playlistUrl}`,
              name: `Stream ${producer.id}`,
              isActive: true,
            });
          } catch (hlsError) {
            console.error("Error starting HLS transcoding:", hlsError);
            // Continue even if HLS transcoding fails
          }
        }

        // Notify all other clients about the new producer
        socket.broadcast.emit("newProducer", {
          socketId: socket.id,
          producerId: producer.id,
          kind: kind,
        });

        console.log(
          `Producer created for ${socket.id}, kind: ${kind}, id: ${producer.id}`
        );
        callback({ id: producer.id });
      } catch (error) {
        console.error("Error in produce:", error);
        callback({ error: error.message });
      }
    });

    // Get HLS stream URL for a specific producer
    socket.on("getHlsStreamUrl", ({ producerId }, callback) => {
      try {
        const hlsStream = hlsStreams[producerId];
        if (hlsStream) {
          callback({ url: hlsStream.playlistUrl });
        } else {
          callback({ error: "HLS stream not found for this producer" });
        }
      } catch (error) {
        console.error("Error in getHlsStreamUrl:", error);
        callback({ error: error.message });
      }
    });

    // Get all available HLS streams
    socket.on("getAvailableHlsStreams", (_, callback) => {
      try {
        const availableStreams = [];

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

        callback({ streams: availableStreams });
      } catch (error) {
        console.error("Error in getAvailableHlsStreams:", error);
        callback({ error: error.message });
      }
    });

    //Creates a new transport that will be used by this peer to receive media
    socket.on("createConsumerTransport", async (_, callback) => {
      try {
        const transport = await router.createWebRtcTransport({
          listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });

        peers[socket.id].consumerTransport = transport;

        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      } catch (err) {
        console.error("createConsumerTransport failed", err);
      }
    });

    //DTLS handshake for consumer
    socket.on(
      "connectConsumerTransport",
      async ({ dtlsParameters }, callback) => {
        await peers[socket.id].consumerTransport.connect({ dtlsParameters });
        callback("connected");
      }
    );
    //step-6 consumer: A peer that receives media
    // When someone wants to consume
    socket.on("consume", async ({ rtpCapabilities }, callback) => {
      try {
        // If the client doesn't have RTP capabilities, we can't create consumers
        if (!rtpCapabilities) {
          return callback({ error: "No RTP capabilities provided" });
        }

        const consumerTransport = peers[socket.id].consumerTransport;
        if (!consumerTransport) {
          return callback({ error: "No consumer transport found" });
        }

        const consumerInfos = [];

        // Iterate through all peers
        for (const [peerId, peer] of Object.entries(peers)) {
          // Skip own streams
          if (peerId === socket.id) continue;

          // Check if this peer has any producers
          if (!peer.producers || peer.producers.size === 0) continue;

          // For each producer of this peer
          for (const [producerId, producer] of peer.producers) {
            // Check if we can consume this producer
            if (!router.canConsume({ producerId, rtpCapabilities })) {
              console.log(
                `Cannot consume producer ${producerId} with client's RTP capabilities`
              );
              continue;
            }

            try {
              // Create a consumer for this producer
              const consumer = await consumerTransport.consume({
                producerId,
                rtpCapabilities,
                paused: false,
              });

              // Store the consumer
              peers[socket.id].consumers.set(consumer.id, consumer);

              // Add to the list of consumer info to send back to client
              consumerInfos.push({
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                peerId: peerId,
              });

              console.log(
                `Created consumer ${consumer.id} for producer ${producerId} (peer ${peerId})`
              );
            } catch (error) {
              console.error(
                `Error creating consumer for producer ${producerId}:`,
                error
              );
            }
          }
        }

        callback(consumerInfos);
      } catch (error) {
        console.error("Error in consume:", error);
        callback({ error: error.message });
      }
    });

    // Listen for new producers from other clients
    socket.on("getProducers", async (_, callback) => {
      try {
        const producerList = [];

        // Iterate through all peers except self
        for (const [peerId, peer] of Object.entries(peers)) {
          if (peerId === socket.id) continue;

          // For each producer of this peer
          if (peer.producers) {
            for (const [producerId, producer] of peer.producers) {
              producerList.push({
                producerId,
                peerId,
                kind: producer.kind,
              });
            }
          }
        }

        callback(producerList);
      } catch (error) {
        console.error("Error in getProducers:", error);
        callback({ error: error.message });
      }
    });

    // Handle consuming a specific producer
    socket.on(
      "consumeProducer",
      async ({ producerId, rtpCapabilities }, callback) => {
        try {
          // Check if we have the consumer transport
          if (!peers[socket.id].consumerTransport) {
            return callback({ error: "No consumer transport found" });
          }

          // Find the producer in any peer
          let producer = null;
          let producerPeerId = null;

          for (const [peerId, peer] of Object.entries(peers)) {
            if (peer.producers && peer.producers.has(producerId)) {
              producer = peer.producers.get(producerId);
              producerPeerId = peerId;
              break;
            }
          }

          if (!producer) {
            return callback({ error: `Producer ${producerId} not found` });
          }

          // Check if the router can consume this producer with the client's RTP capabilities
          if (!router.canConsume({ producerId, rtpCapabilities })) {
            return callback({
              error: `Cannot consume producer ${producerId} with the provided RTP capabilities`,
            });
          }

          // Create a consumer
          const consumer = await peers[socket.id].consumerTransport.consume({
            producerId,
            rtpCapabilities,
            paused: false,
          });

          // Store the consumer
          peers[socket.id].consumers.set(consumer.id, consumer);

          console.log(
            `Created consumer ${consumer.id} for producer ${producerId} (peer ${producerPeerId})`
          );

          // Return the consumer parameters
          callback({
            id: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            peerId: producerPeerId,
          });
        } catch (error) {
          console.error("Error in consumeProducer:", error);
          callback({ error: error.message });
        }
      }
    );

    //event for peer disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Stop HLS transcoding for all producers of this peer
      if (peers[socket.id] && peers[socket.id].hlsStreams) {
        for (const producerId in peers[socket.id].hlsStreams) {
          const hlsStream = peers[socket.id].hlsStreams[producerId];
          stopHlsTranscoding(hlsStream);
          delete hlsStreams[producerId];

          // Notify all clients that this stream has been removed
          io.emit("streamRemoved", producerId);
        }
      }

      // Close all producers
      if (peers[socket.id] && peers[socket.id].producers) {
        for (const producer of peers[socket.id].producers.values()) {
          producer.close();
        }
      }

      // Close all consumers
      if (peers[socket.id] && peers[socket.id].consumers) {
        for (const consumer of peers[socket.id].consumers.values()) {
          consumer.close();
        }
      }

      // Close transports
      if (peers[socket.id] && peers[socket.id].producerTransport) {
        peers[socket.id].producerTransport.close();
      }

      if (peers[socket.id] && peers[socket.id].consumerTransport) {
        peers[socket.id].consumerTransport.close();
      }

      // Remove the peer
      delete peers[socket.id];

      // Notify other clients that this peer disconnected
      socket.broadcast.emit("peerDisconnected", { socketId: socket.id });
    });
  });
};
