"use client";
import { useEffect, useRef } from "react";
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

let socket: any;

export default function StreamPage() {
  const socketRef = useRef<any>(null);

  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (socketRef.current) return; // already connected
    const start = async () => {
      socket = io("http://localhost:4000");

      socket.on("connect", async () => {
        if (socketRef.current) return; // already connected
        console.log("Connected to server");

        //getRouterRtpCapabilities is the event fired to ask codecs/formats
        //from server by the client
        const rtpCapabilities =
          await new Promise<mediasoupClient.types.RtpCapabilities>(
            (resolve) => {
              socket.emit("getRouterRtpCapabilities", null, resolve);
            }
          );
        //A new Device instance is created using the mediasoup-client library,
        // and the router's RTP capabilities are loaded into it
        const device = new mediasoupClient.Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });

        // creating a stream from user by askinghom video and audio permission
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        //displaying local stream in the browser
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }

        //The createWebRtcTransport event is emitted to the
        //server to create a WebRTC transport for producing media.
        const producerTransportInfo =
          await new Promise<mediasoupClient.types.TransportOptions>(
            (resolve) => {
              socket.emit("createWebRtcTransport", null, resolve);
            }
          );
        // Add a console log to inspect the transport options -- mistral
        console.log("Producer Transport Info:", producerTransportInfo);

        const producerTransport = device.createSendTransport(
          producerTransportInfo
        );

        //The connectTransport event is emitted to connect the producer transport.
        producerTransport.on(
          "connect",
          ({ dtlsParameters }, callback, errback) => {
            socket.emit("connectTransport", { dtlsParameters }, (res: any) => {
              if (res === "connected") callback();
              else errback(new Error("Failed to connect producer transport"));
            });
          }
        );

        //The produce event is emitted to start producing media tracks
        // (video and audio) from the user's media stream.
        producerTransport.on(
          "produce",
          ({ kind, rtpParameters }, callback, errback) => {
            socket.emit(
              "produce",
              { kind, rtpParameters },
              ({ id }: { id: string }) => {
                callback({ id });
              }
            );
          }
        );

        //sending actual tracks
        for (const track of stream.getTracks()) {
          await producerTransport.produce({ track });
        }

        console.log("Producing media");

        // CONSUMER LOGIC (User 2)
        //The createConsumerTransport event is emitted to
        //the server to create a WebRTC transport for consuming media
        const consumerTransportInfo =
          await new Promise<mediasoupClient.types.TransportOptions>(
            (resolve) => {
              socket.emit("createConsumerTransport", null, resolve);
            }
          );

        //---------mistral.ai-------------//
        console.log("Consumer Transport Info:", consumerTransportInfo);

        const consumerTransport = device.createRecvTransport(
          consumerTransportInfo
        );

        consumerTransport.on(
          "connect",
          ({ dtlsParameters }, callback, errback) => {
            socket.emit(
              "connectConsumerTransport",
              { dtlsParameters },
              (res: any) => {
                if (res === "connected") callback();
                else errback(new Error("Failed to connect consumer transport"));
              }
            );
          }
        );

        //The consume event is emitted to start
        //consuming media tracks from other producers.
        const consumersInfo = await new Promise<
          {
            id: string;
            producerId: string;
            kind: mediasoupClient.types.MediaKind;
            rtpParameters: mediasoupClient.types.RtpParameters;
          }[]
        >((resolve) => {
          socket.emit(
            "consume",
            { rtpCapabilities: device.rtpCapabilities },
            resolve
          );
        });

        console.log("Consumer Info:", consumersInfo);
        for (const info of consumersInfo) {
          const consumer = await consumerTransport.consume({
            id: info.id,
            producerId: info.producerId,
            kind: info.kind,
            rtpParameters: info.rtpParameters,
          });

          //The remote video element is set to display the media stream
          // from other producers
          const remoteStream = new MediaStream([consumer.track]);

          if (remoteVideo.current) {
            remoteVideo.current.srcObject = remoteStream;
          }

          console.log("Consuming media");
        }
      });
    };

    start();
  }, []);

  return (
    <div className="p-4 flex flex-col">
      <h2 className="mb-1">🟢 Local Stream</h2>
      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        className="w-full max-w-md border shadow rounded-lg mb-4"
      />

      <h2 className="mb-1">🔴 Remote Stream</h2>
      <video
        ref={remoteVideo}
        autoPlay
        playsInline
        className="w-full max-w-md border shadow rounded-lg"
      />
    </div>
  );
}
