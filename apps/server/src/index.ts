import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);

// Handling cors
const io = new SocketIOServer(server, {
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
import mediasoupServer from "./mediasoupServer";
// Passing socket.io instance to the mediasoupServer
mediasoupServer(io);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 