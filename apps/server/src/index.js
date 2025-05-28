const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const mediasoup = require("mediasoup");

const app = express();
const server = http.createServer(app);

//handling cors
const io = socketIO(server, {
  cors: {
    origin: ["http://localhost:3000", "*"],
    methods: ["GET", "POST"],
    credentials: true
  },
});

app.use(cors({
  origin: ["http://localhost:3000", "*"],
  credentials: true
}));
app.use(express.static("public")); // to serve HLS files

const PORT = 4000;

// Mediasoup logic
const mediasoupServer = require("./mediasoupServer");
//passing socket.io instance to the mediasoupServer
mediasoupServer(io);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
