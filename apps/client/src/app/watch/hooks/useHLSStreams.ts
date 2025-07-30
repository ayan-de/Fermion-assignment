import { useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";
import Hls from "hls.js";

import { HlsStream } from "../../shared/types";

interface StreamPlayer {
  streamId: string;
  hls: Hls | null;
  isPlaying: boolean;
  error: string | null;
}

export function useHLSStreams() {
  const [streams, setStreams] = useState<HlsStream[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [players, setPlayers] = useState<Map<string, StreamPlayer>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (socketRef.current) return; // already connected

    const start = async () => {
      try {
        const socket = io("http://localhost:4000");
        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("Connected to server for watching streams");
          setConnectionStatus("Connected to server");
          setDebugInfo("Connected to server");
          requestAvailableStreams();
        });

        socket.on("disconnect", () => {
          console.log("Disconnected from server");
          setConnectionStatus("Disconnected from server");
          setDebugInfo("Disconnected from server");
        });

        socket.on("newHlsStream", (streamInfo: HlsStream) => {
          console.log("New HLS stream available:", streamInfo);
          setDebugInfo(`New stream: ${streamInfo.id}`);
          addNewStream(streamInfo);
        });

        socket.on("streamRemoved", (streamId: string) => {
          console.log("Stream removed:", streamId);
          setDebugInfo(`Stream removed: ${streamId}`);
          removeStream(streamId);
        });
      } catch (error) {
        console.error("Error connecting to server:", error);
        setConnectionStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        setDebugInfo(`Connection error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };

    start();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      // Clean up all HLS instances
      players.forEach((player) => {
        if (player.hls) {
          player.hls.destroy();
        }
      });
    };
  }, []);

  const requestAvailableStreams = () => {
    if (socketRef.current) {
      setDebugInfo("Requesting available streams...");
      socketRef.current.emit(
        "getAvailableHlsStreams",
        null,
        (response: { streams: HlsStream[] }) => {
          console.log("Available streams response:", response);
          if (response && response.streams) {
            setStreams(response.streams);
            setDebugInfo(`Found ${response.streams.length} streams`);

            // Auto-play streams
            response.streams.forEach((stream) => {
              if (stream.isActive) {
                playStream(stream.id);
              }
            });
          } else {
            setDebugInfo("No streams found or error in response");
          }
        }
      );
    }
  };

  const addNewStream = (streamInfo: HlsStream) => {
    setStreams((prev) => {
      const exists = prev.find((s) => s.id === streamInfo.id);
      if (!exists) {
        const newStreams = [...prev, streamInfo];
        // Auto-play new stream
        if (streamInfo.isActive) {
          setTimeout(() => playStream(streamInfo.id), 1000);
        }
        return newStreams;
      }
      return prev;
    });
  };

  const removeStream = (streamId: string) => {
    setStreams((prev) => prev.filter((s) => s.id !== streamId));
    stopStream(streamId);
  };

  const playStream = async (streamId: string) => {
    try {
      setError(null);
      setDebugInfo(`Attempting to play stream: ${streamId}`);

      const stream = streams.find((s) => s.id === streamId);
      if (!stream) {
        throw new Error("Stream not found");
      }

      // Stop existing player for this stream if any
      stopStream(streamId);

      setDebugInfo(`Loading stream: ${stream.url}`);

      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });

        // Create player object
        const player: StreamPlayer = {
          streamId,
          hls,
          isPlaying: false,
          error: null,
        };

        // Add to players map
        setPlayers((prev) => new Map(prev).set(streamId, player));

        hls.loadSource(stream.url);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log(`HLS manifest parsed for stream ${streamId}`);
          setDebugInfo(`Stream ${streamId} ready to play`);

          // Create hidden video element for this stream
          const video = document.createElement("video");
          video.muted = true; // Mute to allow multiple videos
          video.autoplay = true;
          video.playsInline = true;
          video.style.display = "none";
          document.body.appendChild(video);

          // Store video reference
          videoRefs.current.set(streamId, video);

          hls.attachMedia(video);
          video.play().catch((e) => {
            console.error(`Error playing video for stream ${streamId}:`, e);
            setError(`Error playing stream ${streamId}`);
            setDebugInfo(`Play error for ${streamId}: ${e.message}`);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error(`HLS error for stream ${streamId}:`, data);
          setDebugInfo(`HLS error for ${streamId}: ${data.details}`);
          if (data.fatal) {
            setError(`HLS Error for ${streamId}: ${data.details}`);
            setPlayers((prev) => {
              const newPlayers = new Map(prev);
              const player = newPlayers.get(streamId);
              if (player) {
                player.error = data.details;
                newPlayers.set(streamId, player);
              }
              return newPlayers;
            });
          }
        });

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log(`HLS media attached for stream ${streamId}`);
          setDebugInfo(`Stream ${streamId} media attached`);
        });
      } else {
        throw new Error("HLS is not supported in this browser");
      }
    } catch (error) {
      console.error(`Error playing stream ${streamId}:`, error);
      setError(error instanceof Error ? error.message : "Unknown error");
      setDebugInfo(`Playback error for ${streamId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const stopStream = (streamId: string) => {
    const player = players.get(streamId);
    if (player) {
      if (player.hls) {
        player.hls.destroy();
      }

      // Remove video element
      const video = videoRefs.current.get(streamId);
      if (video) {
        video.remove();
        videoRefs.current.delete(streamId);
      }

      // Remove from players map
      setPlayers((prev) => {
        const newPlayers = new Map(prev);
        newPlayers.delete(streamId);
        return newPlayers;
      });
    }
    setDebugInfo(`Stream ${streamId} stopped`);
  };

  const stopAllStreams = () => {
    players.forEach((player, streamId) => {
      stopStream(streamId);
    });
  };

  const playAllStreams = () => {
    streams.forEach((stream) => {
      if (stream.isActive) {
        playStream(stream.id);
      }
    });
  };

  const refreshStreams = () => {
    stopAllStreams();
    requestAvailableStreams();
  };

  return {
    streams,
    connectionStatus,
    error,
    debugInfo,
    refreshStreams,
    playAllStreams,
    stopAllStreams,
    videoRefs: videoRefs.current,
  };
} 