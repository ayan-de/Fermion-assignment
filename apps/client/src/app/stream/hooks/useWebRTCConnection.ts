import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

export function useWebRTCConnection() {
  const socketRef = useRef<any>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const producerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const consumerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");

  useEffect(() => {
    if (socketRef.current) return; // already connected

    const start = async () => {
      try {
        const socket = io("http://localhost:4000");
        socketRef.current = socket;

        socket.on("connect", async () => {
          console.log("Connected to server");
          setConnectionStatus("Connected to server");

          // Step 1: Get router RTP capabilities
          setConnectionStatus("Getting router capabilities...");
          const rtpCapabilities = await new Promise<mediasoupClient.types.RtpCapabilities>(
            (resolve) => {
              socket.emit("getRouterRtpCapabilities", null, resolve);
            }
          );

          // Step 2: Create and load device
          setConnectionStatus("Loading device...");
          const device = new mediasoupClient.Device();
          await device.load({ routerRtpCapabilities: rtpCapabilities });
          deviceRef.current = device;

          // Step 3: Get user media
          setConnectionStatus("Requesting camera access...");
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

          // Step 4: Create producer transport
          setConnectionStatus("Creating producer transport...");
          const producerTransportInfo = await new Promise<mediasoupClient.types.TransportOptions>(
            (resolve) => {
              socket.emit("createWebRtcTransport", null, (info: any) => {
                if (info.error) {
                  console.error("Error creating producer transport:", info.error);
                  setConnectionStatus(`Error: ${info.error}`);
                  return;
                }
                resolve(info);
              });
            }
          );

          const producerTransport = device.createSendTransport(producerTransportInfo);
          producerTransportRef.current = producerTransport;

          // Handle producer transport events
          producerTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
            setConnectionStatus("Connecting producer transport...");
            socket.emit("connectTransport", { dtlsParameters }, (res: any) => {
              if (res === "connected") {
                callback();
              } else {
                errback(new Error("Failed to connect producer transport"));
                setConnectionStatus("Failed to connect producer transport");
              }
            });
          });

          producerTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
            setConnectionStatus(`Producing ${kind}...`);
            socket.emit("produce", { kind, rtpParameters }, (response: any) => {
              if (response.error) {
                errback(new Error(response.error));
                return;
              }
              callback({ id: response.id });
            });
          });

          // Send media tracks
          setConnectionStatus("Sending media tracks...");
          for (const track of stream.getTracks()) {
            await producerTransport.produce({ track });
          }

          console.log("Producing media");
          setConnectionStatus("Producing media");

          // Step 5: Create consumer transport
          setConnectionStatus("Creating consumer transport...");
          const consumerTransportInfo = await new Promise<mediasoupClient.types.TransportOptions>(
            (resolve) => {
              socket.emit("createConsumerTransport", null, (info: any) => {
                if (info.error) {
                  console.error("Error creating consumer transport:", info.error);
                  setConnectionStatus(`Error: ${info.error}`);
                  return;
                }
                resolve(info);
              });
            }
          );

          const consumerTransport = device.createRecvTransport(consumerTransportInfo);
          consumerTransportRef.current = consumerTransport;

          consumerTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
            setConnectionStatus("Connecting consumer transport...");
            socket.emit("connectConsumerTransport", { dtlsParameters }, (res: any) => {
              if (res === "connected") {
                callback();
              } else {
                errback(new Error("Failed to connect consumer transport"));
                setConnectionStatus("Failed to connect consumer transport");
              }
            });
          });

          // Step 6: Consume existing producers
          await consumeExistingProducers(device, consumerTransport);

          // Step 7: Set up listeners
          socket.on("newProducer", async ({ socketId, producerId, kind }: any) => {
            console.log(`New producer: ${socketId}, ${producerId}, ${kind}`);
            await consumeProducer(device, consumerTransport, producerId);
          });

          socket.on("peerDisconnected", ({ socketId }: any) => {
            console.log(`Peer disconnected: ${socketId}`);
          });

          setConnectionStatus("Ready");
        });

        socket.on("disconnect", () => {
          console.log("Disconnected from server");
          setConnectionStatus("Disconnected from server");
        });
      } catch (error: unknown) {
        console.error("Error in WebRTC setup:", error);
        setConnectionStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };

    const consumeProducer = async (
      device: mediasoupClient.Device,
      consumerTransport: mediasoupClient.types.Transport,
      producerId: string
    ) => {
      try {
        const consumerParameters = await new Promise<any>((resolve) => {
          socketRef.current.emit(
            "consumeProducer",
            {
              producerId,
              rtpCapabilities: device.rtpCapabilities,
            },
            (response: any) => {
              if (response.error) {
                console.error(`Error consuming producer: ${response.error}`);
                resolve(null);
                return;
              }
              resolve(response);
            }
          );
        });

        if (!consumerParameters) {
          console.warn(`Cannot consume producer ${producerId}`);
          return null;
        }

        const consumer = await consumerTransport.consume({
          id: consumerParameters.id,
          producerId: consumerParameters.producerId,
          kind: consumerParameters.kind,
          rtpParameters: consumerParameters.rtpParameters,
        });

        const remoteStream = new MediaStream([consumer.track]);
        return { consumer, remoteStream };
      } catch (error) {
        console.error(`Error consuming producer ${producerId}:`, error);
        return null;
      }
    };

    const consumeExistingProducers = async (
      device: mediasoupClient.Device,
      consumerTransport: mediasoupClient.types.Transport
    ) => {
      try {
        setConnectionStatus("Consuming existing streams...");

        const producers = await new Promise<any[]>((resolve) => {
          socketRef.current.emit("getProducers", null, (producerList: any) => {
            if (producerList.error) {
              console.error("Error getting producers:", producerList.error);
              resolve([]);
              return;
            }
            resolve(producerList);
          });
        });

        console.log("Existing producers:", producers);

        if (producers.length === 0) {
          console.log("No existing producers to consume");
          return;
        }

        const remoteStream = new MediaStream();

        for (const { producerId } of producers) {
          const result = await consumeProducer(device, consumerTransport, producerId);
          if (result && result.consumer.track) {
            remoteStream.addTrack(result.consumer.track);
          }
        }

        if (remoteStream.getTracks().length > 0) {
          console.log("Displaying remote stream with", remoteStream.getTracks().length, "tracks");
          return remoteStream;
        } else {
          console.log("No remote tracks to display");
          return null;
        }
      } catch (error) {
        console.error("Error consuming existing producers:", error);
        return null;
      }
    };

    start();
  }, []);

  return {
    connectionStatus,
    isConnected: connectionStatus === "Ready",
    socket: socketRef.current,
    device: deviceRef.current,
    producerTransport: producerTransportRef.current,
    consumerTransport: consumerTransportRef.current,
  };
} 