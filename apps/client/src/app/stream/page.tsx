"use client";
import { useEffect, useRef } from "react";
import io from "socket.io-client";

let socket: any;

export default function StreamPage() {
  const localVideo = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const socket = io("http://localhost:4000");

    socket.on("connect", async () => {
      console.log("Connected to server");

      const rtpCapabilities = await new Promise((resolve) => {
        socket.emit("getRouterRtpCapabilities", null, resolve);
      });

      console.log("Router RTP Capabilities:", rtpCapabilities);
      // TODO: Load Mediasoup device and continue
    });

    //Requests permission to access the user's webcam and mic
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }

        // TODO: send this stream to Mediasoup server (createTransport → produce)
        // Save stream globally if needed
        window.localStream = stream;
      });
  }, []);

  return (
    <div>
      <h1 className="text-xl">/stream</h1>
      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        className="w-full max-w-md"
      />
    </div>
  );
}
