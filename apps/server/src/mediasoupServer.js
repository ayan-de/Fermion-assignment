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

    //event for peer disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      delete peers[socket.id];
    });

    //TODO: Step-by-step: createTransport, connectTransport, produce, consume, etc.
    // We’ll fill this out next
  });
};
