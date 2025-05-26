//Mediasoup router, transport, producer/consumer setup
const mediasoup = require("mediasoup");

//A Mediasoup worker is a background thread that handles all media traffic
let worker;
//Handles RTP capabilities and media routing between transports
let router;
// Object to track connected users (socket.id as key)
let peers = {};

module.exports = async function (io) {
  worker = await mediasoup.createWorker();

  //setting up which media codecs the server supports
  //this handles forwarding streams between clients
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
    peers[socket.id] = {};

    //This allows the frontend to fetch the RTP capabilities of your Mediasoup router (required before creating transports)
    socket.on("getRouterRtpCapabilities", (_, callback) => {
      callback(router.rtpCapabilities);
    });

    const transports = [];
    const producers = [];

    socket.on("createWebRtcTransport", async (_, callback) => {
      try {
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

        transports.push(transport);

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

    socket.on("connectTransport", async ({ dtlsParameters }, callback) => {
      await peers[socket.id].producerTransport.connect({ dtlsParameters });
      callback("connected");
    });

    socket.on("produce", async ({ kind, rtpParameters }, callback) => {
      const transport = peers[socket.id].producerTransport;
      const producer = await transport.produce({ kind, rtpParameters });

      producers.push(producer);
      peers[socket.id].producer = producer;

      callback({ id: producer.id });
    });

    //event for peer disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      delete peers[socket.id];
    });

    //TODO: Step-by-step: createTransport, connectTransport, produce, consume, etc.
    // We’ll fill this out next
  });
};
