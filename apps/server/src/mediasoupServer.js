//Mediasoup router, transport, producer/consumer setup
const mediasoup = require("mediasoup");

//A Mediasoup worker is a background thread that handles all media traffic
let worker;
//Handles RTP capabilities and media routing between transports
let router;
// Object to track connected users (socket.id as key)
let peers = {};

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

  // Track producers per client
  const peers = new Map(); // socket.id => { producerId }

  //events for peer connection
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    //When a user connects, they're assigned a socket.id and added to the peers object.
    peers[socket.id] = {};

    //step-3  Get RTP Capabilities
    //This allows the frontend to fetch the RTP capabilities of your Mediasoup router (required before creating transports)
    socket.on("getRouterRtpCapabilities", (_, callback) => {
      callback(router.rtpCapabilities);
    });

    const transports = [];
    const producers = [];

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

        //storing a list of transport
        transports.push(transport);

        //sending back to client everything it needs to connect
        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });

        // Save it for this peer
        peers[socket.id].producerTransport = transport;
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
      const transport = peers[socket.id].producerTransport;
      const producer = await transport.produce({ kind, rtpParameters });

      //Stores the producer for use by other consumers
      // producers.push(producer);
      // peers[socket.id].producer = producer;

      // Store producerId for this socket
      peers.set(socket.id, {
        ...(peers.get(socket.id) || {}),
        producerId: producer.id,
      });

      callback({ id: producer.id });
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
    //-----------------------mistral//////////////////
    // Update the consume event handler to handle multiple producers
    //step-6 consumer: A peer that receives media
    // When someone wants to consume
    socket.on("consume", async ({ rtpCapabilities }, callback) => {
      const consumerInfos = [];

      for (const [id, peer] of peers.entries()) {
        if (id === socket.id) continue; // skip own stream
        if (!peer.producer) continue;

        const producer = peer.producer;

        if (router.canConsume({ producerId: producer.id, rtpCapabilities })) {
          const consumer = await consumerTransport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: false,
          });

          consumerInfos.push({
            id: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          });

          // Optionally: store the consumer on the socket if you want to manage cleanup later
        }
      }

      callback(consumerInfos);
    });

    // socket.on("consume", async ({ rtpCapabilities }, callback) => {
    //   const producer = Object.values(peers).find((p) => p.producer)?.producer;
    //   if (!producer) return console.warn("No producer found");

    //   if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
    //     console.error("Cannot consume");
    //     return;
    //   }

    //   const consumer = await peers[socket.id].consumerTransport.consume({
    //     producerId: producer.id,
    //     rtpCapabilities,
    //     paused: false,
    //   });

    //   peers[socket.id].consumer = consumer;

    //   callback({
    //     id: consumer.id,
    //     producerId: producer.id,
    //     kind: consumer.kind,
    //     rtpParameters: consumer.rtpParameters,
    //   });
    // });

    //event for peer disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      delete peers[socket.id];
    });
  });
};
