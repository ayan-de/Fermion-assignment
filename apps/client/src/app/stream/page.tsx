"use client";
import { useEffect, useRef } from "react";
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

let socket: any;

export default function StreamPage() {
  const localVideo = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    socket = io("http://localhost:4000");

    socket.on("connect", async () => {
      console.log("Connected to server");

      // Get RTP Capabilities from server
      const rtpCapabilities =
        await new Promise<mediasoupClient.types.RtpCapabilities>((resolve) => {
          socket.emit("getRouterRtpCapabilities", null, resolve);
        });

      // Load Mediasoup Device
      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });

      // Ask server to create a producer transport
      const data = await new Promise<any>((resolve) => {
        socket.emit("createWebRtcTransport", null, resolve);
      });

      // Create send transport on client
      const transport = device.createSendTransport(data);

      // Connect transport to server
      transport.on("connect", ({ dtlsParameters }, callback, errback) => {
        socket.emit("connectTransport", { dtlsParameters }, (res: any) => {
          if (res === "connected") callback();
          else errback(new Error("Failed to connect transport"));
        });
      });

      // Produce media when transport is ready
      transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
        socket.emit(
          "produce",
          { kind, rtpParameters },
          ({ id }: { id: string }) => {
            callback({ id });
          }
        );
      });

      // Get camera/mic
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Show stream locally
      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }

      // Send video/audio to server
      for (const track of stream.getTracks()) {
        await transport.produce({ track });
      }

      console.log("Producing media to server");
    });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">/stream</h1>
      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        className="w-full max-w-md border shadow rounded-lg"
      />
    </div>
  );
}
