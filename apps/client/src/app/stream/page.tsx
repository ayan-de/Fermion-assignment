"use client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

let socket: any;

export default function StreamPage() {
  const socketRef = useRef<any>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const producerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const consumerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");

  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (socketRef.current) return; // already connected
    const start = async () => {
      try {
        // Connect to the server creates websocket connection
        socket = io("http://localhost:4000");
        //user1 connects stores reference to the socket
        socketRef.current = socket;
        
        socket.on("connect", async () => {
          console.log("Connected to server");
          setConnectionStatus("Connected to server");

          // Step 1:client emits Get router RTP capabilities
          setConnectionStatus("Getting router capabilities...");
          //storing in rtpCapabilities variable the server response
          const rtpCapabilities = await new Promise<mediasoupClient.types.RtpCapabilities>(
            (resolve) => {
              socket.emit("getRouterRtpCapabilities", null, resolve);
            }
          );
          
          // Step 2: Create and load a mediasoup client device with the router's RTP capabilities
          setConnectionStatus("Loading device...");
          const device = new mediasoupClient.Device();
          //loads router capabilities
          await device.load({ routerRtpCapabilities: rtpCapabilities });
          //stores reference to device
          deviceRef.current = device;
          
          // Step 3: Get user media (camera/microphone)
          setConnectionStatus("Requesting camera access...");
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          
          // Display local stream
          if (localVideo.current) {
            localVideo.current.srcObject = stream;
          }

          // Step 4: Create producer transport (for sending our media)
          setConnectionStatus("Creating producer transport...");
          //Server creates a transport and returns transport info
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
          
          console.log("Producer Transport Info:", producerTransportInfo);
          
          // Create the producer transport by client
          const producerTransport = device.createSendTransport(producerTransportInfo);
          //stores reference to producerTransport
          producerTransportRef.current = producerTransport;
          
          // Handle producer transport connect event
          producerTransport.on(
            "connect",
            ({ dtlsParameters }, callback, errback) => {
              setConnectionStatus("Connecting producer transport...");
              //client emits connectTransport event to server
              socket.emit("connectTransport", { dtlsParameters }, (res: any) => {
                if (res === "connected") {
                  callback();
                } else {
                  errback(new Error("Failed to connect producer transport"));
                  setConnectionStatus("Failed to connect producer transport");
                }
              });
            }
          );
          
          // Handle producer transport produce event
          producerTransport.on(
            "produce",
            ({ kind, rtpParameters }, callback, errback) => {
              setConnectionStatus(`Producing ${kind}...`);
              //Client emits produce event with kind (audio/video) and RTP parameters
              socket.emit(
                "produce",
                { kind, rtpParameters },
                (response: any) => {
                  if (response.error) {
                    errback(new Error(response.error));
                    return;
                  }
                  callback({ id: response.id });
                }
              );
            }
          );
          
          // Send our media tracks
          setConnectionStatus("Sending media tracks...");
          for (const track of stream.getTracks()) {
            await producerTransport.produce({ track });
          }
          
          console.log("Producing media");
          setConnectionStatus("Producing media");

          // Step 5: Create consumer transport (for receiving others' media)
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
          
          console.log("Consumer Transport Info:", consumerTransportInfo);
          
          // Create the consumer transport
          const consumerTransport = device.createRecvTransport(consumerTransportInfo);
          consumerTransportRef.current = consumerTransport;
          
          // Handle consumer transport connect event
          consumerTransport.on(
            "connect",
            ({ dtlsParameters }, callback, errback) => {
              setConnectionStatus("Connecting consumer transport...");
              socket.emit(
                "connectConsumerTransport",
                { dtlsParameters },
                (res: any) => {
                  if (res === "connected") {
                    callback();
                  } else {
                    errback(new Error("Failed to connect consumer transport"));
                    setConnectionStatus("Failed to connect consumer transport");
                  }
                }
              );
            }
          );
          
          // Step 6: Consume remote streams
          await consumeExistingProducers(device, consumerTransport);
          
          // Step 7: Set up listener for new producers
          socket.on("newProducer", async ({ socketId, producerId, kind }: { socketId: string; producerId: string; kind: string }) => {
            console.log(`New producer: ${socketId}, ${producerId}, ${kind}`);
            await consumeProducer(device, consumerTransport, producerId);
          });
          
          // Step 8: Handle peer disconnection
          socket.on("peerDisconnected", ({ socketId }: { socketId: string }) => {
            console.log(`Peer disconnected: ${socketId}`);
            // If we're displaying this peer's stream, we could remove it here
            // For now, we'll just log it
          });
          
          setConnectionStatus("Ready");
        });
        
        // Handle socket disconnection
        socket.on("disconnect", () => {
          console.log("Disconnected from server");
          setConnectionStatus("Disconnected from server");
        });
        
      } catch (error: unknown) {
        console.error("Error in WebRTC setup:", error);
        setConnectionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    
    // Function to consume an individual producer
    const consumeProducer = async (
      device: mediasoupClient.Device,
      consumerTransport: mediasoupClient.types.Transport,
      producerId: string
    ) => {
      try {
        // Request consumer parameters from the server
        const consumerParameters = await new Promise<any>((resolve) => {
          socket.emit(
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
        
        // Consume the producer with the parameters from the server
        const consumer = await consumerTransport.consume({
          id: consumerParameters.id,
          producerId: consumerParameters.producerId,
          kind: consumerParameters.kind,
          rtpParameters: consumerParameters.rtpParameters,
        });
        
        // Create a MediaStream with the consumer's track
        const remoteStream = new MediaStream([consumer.track]);
        
        // Display the remote stream
        if (remoteVideo.current) {
          remoteVideo.current.srcObject = remoteStream;
        }
        
        console.log(`Consuming producer ${producerId}`);
        return consumer;
      } catch (error) {
        console.error(`Error consuming producer ${producerId}:`, error);
        return null;
      }
    };
    
    // Function to consume all existing producers
    const consumeExistingProducers = async (
      device: mediasoupClient.Device,
      consumerTransport: mediasoupClient.types.Transport
    ) => {
      try {
        setConnectionStatus("Consuming existing streams...");
        
        // Get existing producers
        const producers = await new Promise<any[]>((resolve) => {
          socket.emit("getProducers", null, (producerList: any) => {
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
        
        // Create a MediaStream to hold all remote tracks
        const remoteStream = new MediaStream();
        
        // Consume each producer individually using our new method
        for (const { producerId } of producers) {
          const consumer = await consumeProducer(device, consumerTransport, producerId);
          if (consumer && consumer.track) {
            // Add the track to our remote stream
            remoteStream.addTrack(consumer.track);
          }
        }
        
        // Display the remote stream if we have any tracks
        if (remoteStream.getTracks().length > 0 && remoteVideo.current) {
          remoteVideo.current.srcObject = remoteStream;
          console.log("Displaying remote stream with", remoteStream.getTracks().length, "tracks");
        } else {
          console.log("No remote tracks to display");
        }
      } catch (error) {
        console.error("Error consuming existing producers:", error);
      }
    };
    start();
  }, []);

  return (
    <div className="p-4 flex flex-col">
      <div className="mb-4 p-2 bg-gray-100 rounded-lg">
        <p className="text-sm font-mono">Status: {connectionStatus}</p>
      </div>
      
      <h2 className="mb-1 text-lg font-semibold">🟢 Local Stream</h2>
      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        className="w-full max-w-md border shadow rounded-lg mb-6"
      />

      <h2 className="mb-1 text-lg font-semibold">🔴 Remote Stream</h2>
      <video
        ref={remoteVideo}
        autoPlay
        playsInline
        className="w-full max-w-md border shadow rounded-lg"
      />
      
      <p className="mt-4 text-sm text-gray-600">
        Open this page in another browser window or incognito mode to see the remote stream.
      </p>
    </div>
  );
}
