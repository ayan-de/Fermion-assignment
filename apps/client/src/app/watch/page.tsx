"use client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Hls from "hls.js";

let socket: any;

interface HlsStream {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
}

export default function WatchPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [streams, setStreams] = useState<HlsStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Disconnected");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    if (socket) return; // already connected

    const start = async () => {
      try {
        // Connect to the server
        socket = io("http://localhost:4000");
        socket.on("connect", () => {
          console.log("Connected to server for watching streams");
          setConnectionStatus("Connected to server");
          setDebugInfo("Connected to server");

          // Request available HLS streams
          requestAvailableStreams();
        });

        socket.on("disconnect", () => {
          console.log("Disconnected from server");
          setConnectionStatus("Disconnected from server");
          setDebugInfo("Disconnected from server");
        });

        // Listen for new HLS streams
        socket.on("newHlsStream", (streamInfo: any) => {
          console.log("New HLS stream available:", streamInfo);
          setDebugInfo(`New stream: ${streamInfo.id}`);
          addNewStream(streamInfo);
        });

        // Listen for stream removal
        socket.on("streamRemoved", (streamId: string) => {
          console.log("Stream removed:", streamId);
          setDebugInfo(`Stream removed: ${streamId}`);
          removeStream(streamId);
        });
      } catch (error) {
        console.error("Error connecting to server:", error);
        setConnectionStatus(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        setDebugInfo(
          `Connection error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    };

    start();

    return () => {
      if (socket) {
        socket.disconnect();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  const requestAvailableStreams = () => {
    if (socket) {
      setDebugInfo("Requesting available streams...");
      socket.emit("getAvailableHlsStreams", null, (response: any) => {
        console.log("Available streams response:", response);
        if (response && response.streams) {
          setStreams(response.streams);
          setDebugInfo(`Found ${response.streams.length} streams`);
        } else {
          setDebugInfo("No streams found or error in response");
        }
      });
    }
  };

  const addNewStream = (streamInfo: any) => {
    setStreams((prev) => {
      const existing = prev.find((s) => s.id === streamInfo.id);
      if (existing) {
        return prev.map((s) =>
          s.id === streamInfo.id ? { ...s, ...streamInfo } : s
        );
      }
      return [...prev, streamInfo];
    });
  };

  const removeStream = (streamId: string) => {
    setStreams((prev) => prev.filter((s) => s.id !== streamId));
    if (selectedStream === streamId) {
      stopStream();
      setSelectedStream(null);
    }
  };

  const playStream = async (streamId: string) => {
    try {
      setError(null);
      setDebugInfo(`Attempting to play stream: ${streamId}`);

      // Stop current stream if playing
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Find the stream
      const stream = streams.find((s) => s.id === streamId);
      if (!stream) {
        throw new Error("Stream not found");
      }

      setSelectedStream(streamId);
      setIsPlaying(true);
      setDebugInfo(`Loading stream: ${stream.url}`);

      if (videoRef.current) {
        const video = videoRef.current;

        // Check if HLS is supported
        if (Hls.isSupported()) {
          const hls = new Hls({
            debug: true, // Enable debug logging
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
          });

          hlsRef.current = hls;

          hls.loadSource(stream.url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS manifest parsed, starting playback");
            setDebugInfo("HLS manifest parsed, starting playback");
            video.play().catch((e) => {
              console.error("Error playing video:", e);
              setError("Error playing video");
              setDebugInfo(`Play error: ${e.message}`);
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error("HLS error:", data);
            setDebugInfo(
              `HLS error: ${data.details} - ${
                data.fatal ? "FATAL" : "NON-FATAL"
              }`
            );
            if (data.fatal) {
              setError(`HLS Error: ${data.details}`);
            }
          });

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            console.log("HLS media attached");
            setDebugInfo("HLS media attached to video element");
          });

          hls.on(Hls.Events.MANIFEST_LOADING, () => {
            console.log("HLS manifest loading");
            setDebugInfo("Loading HLS manifest...");
          });

          hls.on(Hls.Events.MANIFEST_LOADED, () => {
            console.log("HLS manifest loaded");
            setDebugInfo("HLS manifest loaded successfully");
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // For Safari and other browsers with native HLS support
          setDebugInfo("Using native HLS support");
          video.src = stream.url;
          video.addEventListener("loadedmetadata", () => {
            video.play().catch((e) => {
              console.error("Error playing video:", e);
              setError("Error playing video");
              setDebugInfo(`Native play error: ${e.message}`);
            });
          });
        } else {
          throw new Error("HLS is not supported in this browser");
        }
      }
    } catch (error) {
      console.error("Error playing stream:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
      setDebugInfo(
        `Playback error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsPlaying(false);
    }
  };

  const stopStream = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.src = "";
    }
    setIsPlaying(false);
    setSelectedStream(null);
    setDebugInfo("Stream stopped");
  };

  const refreshStreams = () => {
    requestAvailableStreams();
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Watch Streams</h1>
        <div className="flex items-center gap-4 mb-4">
          <div className="px-3 py-1 bg-gray-100 rounded-lg">
            <span className="text-sm font-mono">
              Status: {connectionStatus}
            </span>
          </div>
          <button
            onClick={refreshStreams}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Refresh Streams
          </button>
        </div>

        {/* Debug Info */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-mono text-yellow-800">
            Debug: {debugInfo}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stream List */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4">Available Streams</h2>
          {streams.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No streams available</p>
              <p className="text-sm text-gray-500 mt-2">
                Start streaming from another browser to see streams here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {streams.map((stream) => (
                <div
                  key={stream.id}
                  className={`p-3 border rounded-lg cursor-pointer transition ${
                    selectedStream === stream.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => playStream(stream.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">
                        {stream.name || `Stream ${stream.id}`}
                      </h3>
                      <p className="text-sm text-gray-600">{stream.id}</p>
                      <p className="text-xs text-gray-500">{stream.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          stream.isActive ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      {selectedStream === stream.id && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Playing
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Player */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Video Player</h2>
          <div className="bg-black rounded-lg overflow-hidden">
            {selectedStream ? (
              <video
                ref={videoRef}
                controls
                className="w-full h-96 object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={(e) => {
                  console.error("Video error:", e);
                  setError("Video playback error");
                  setDebugInfo(
                    `Video error: ${
                      e.currentTarget.error?.message || "Unknown"
                    }`
                  );
                }}
              />
            ) : (
              <div className="w-full h-96 flex items-center justify-center bg-gray-900">
                <div className="text-center text-gray-400">
                  <div className="text-6xl mb-4">📺</div>
                  <p className="text-lg">Select a stream to start watching</p>
                  <p className="text-sm mt-2">
                    Available streams will appear in the list on the left
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {selectedStream && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={stopStream}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Stop Stream
              </button>
              <button
                onClick={() => playStream(selectedStream)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Restart Stream
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">How to use:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>
            Open another browser window/tab and go to{" "}
            <code className="bg-gray-200 px-1 rounded">
              http://localhost:3000/stream
            </code>
          </li>
          <li>Allow camera and microphone access to start streaming</li>
          <li>Come back to this page and click "Refresh Streams"</li>
          <li>Click on any available stream to start watching</li>
          <li>Check the debug info above for troubleshooting</li>
        </ol>
      </div>
    </div>
  );
}
