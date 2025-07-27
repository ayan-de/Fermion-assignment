"use client";
import { useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";
import Hls from "hls.js";

let socket: Socket | null = null;

interface HlsStream {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
}

interface StreamPlayer {
  streamId: string;
  hls: Hls | null;
  isPlaying: boolean;
  error: string | null;
}

export default function WatchPage() {
  const [streams, setStreams] = useState<HlsStream[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Disconnected");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [layout, setLayout] = useState<"main+side" | "grid" | "single">(
    "main+side"
  );
  const [mainStream, setMainStream] = useState<string | null>(null);
  const [sideStreams, setSideStreams] = useState<string[]>([]);

  // Track all active players
  const [players, setPlayers] = useState<Map<string, StreamPlayer>>(new Map());

  // Canvas ref for collage
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (socket) return; // already connected

    const start = async () => {
      try {
        socket = io("http://localhost:4000");
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
      // Clean up all HLS instances
      players.forEach((player) => {
        if (player.hls) {
          player.hls.destroy();
        }
      });
    };
  }, []);

  // Canvas rendering effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderCanvas = () => {
      // Clear canvas
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (layout === "single" && mainStream) {
        const video = videoRefs.current.get(mainStream);
        if (video && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      } else if (layout === "grid") {
        // Grid layout
        const activeStreams = streams.filter((s) => s.isActive);
        const cols = Math.ceil(Math.sqrt(activeStreams.length));
        const rows = Math.ceil(activeStreams.length / cols);
        const cellWidth = canvas.width / cols;
        const cellHeight = canvas.height / rows;

        activeStreams.forEach((stream, index) => {
          const video = videoRefs.current.get(stream.id);
          if (video && video.videoWidth > 0) {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = col * cellWidth;
            const y = row * cellHeight;
            ctx.drawImage(video, x, y, cellWidth, cellHeight);
          }
        });
      } else if (layout === "main+side") {
        // Main stream + side streams layout
        const mainVideo = mainStream ? videoRefs.current.get(mainStream) : null;
        const sideVideos = sideStreams
          .map((id) => videoRefs.current.get(id))
          .filter(Boolean);

        if (mainVideo && mainVideo.videoWidth > 0) {
          // Main stream takes 50% of width, full height
          const mainWidth = canvas.width * 0.5;
          const mainHeight = canvas.height;
          ctx.drawImage(mainVideo, 0, 0, mainWidth, mainHeight);

          // Side streams on the right
          if (sideVideos.length > 0) {
            const sideWidth = canvas.width * 0.5;
            const sideHeight = canvas.height / sideVideos.length;

            sideVideos.forEach((video, index) => {
              if (video && video.videoWidth > 0) {
                const x = mainWidth;
                const y = index * sideHeight;
                ctx.drawImage(video, x, y, sideWidth, sideHeight);
              }
            });
          }
        } else if (sideVideos.length > 0) {
          // If no main stream, show side streams in grid
          const cols = Math.ceil(Math.sqrt(sideVideos.length));
          const rows = Math.ceil(sideVideos.length / cols);
          const cellWidth = canvas.width / cols;
          const cellHeight = canvas.height / rows;

          sideVideos.forEach((video, index) => {
            if (video && video.videoWidth > 0) {
              const col = index % cols;
              const row = Math.floor(index / cols);
              const x = col * cellWidth;
              const y = row * cellHeight;
              ctx.drawImage(video, x, y, cellWidth, cellHeight);
            }
          });
        }
      }

      requestAnimationFrame(renderCanvas);
    };

    renderCanvas();
  }, [layout, mainStream, sideStreams, streams]);

  const requestAvailableStreams = () => {
    if (socket) {
      setDebugInfo("Requesting available streams...");
      socket.emit(
        "getAvailableHlsStreams",
        null,
        (response: { streams: HlsStream[] }) => {
          console.log("Available streams response:", response);
          if (response && response.streams) {
            setStreams(response.streams);
            setDebugInfo(`Found ${response.streams.length} streams`);

            // Auto-setup layout
            if (response.streams.length > 0) {
              const activeStreams = response.streams.filter((s) => s.isActive);
              if (activeStreams.length === 1) {
                setLayout("single");
                setMainStream(activeStreams[0].id);
              } else if (activeStreams.length === 2) {
                setLayout("main+side");
                setMainStream(activeStreams[0].id);
                setSideStreams([activeStreams[1].id]);
              } else {
                setLayout("grid");
              }

              // Auto-play streams
              activeStreams.forEach((stream) => {
                playStream(stream.id);
              });
            }
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

    // Update layout if needed
    if (mainStream === streamId) {
      const remainingStreams = streams.filter(
        (s) => s.id !== streamId && s.isActive
      );
      if (remainingStreams.length > 0) {
        setMainStream(remainingStreams[0].id);
      } else {
        setMainStream(null);
      }
    }

    setSideStreams((prev) => prev.filter((id) => id !== streamId));
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
      setDebugInfo(
        `Playback error for ${streamId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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

  const setMainStreamHandler = (streamId: string) => {
    setMainStream(streamId);
    setSideStreams((prev) => prev.filter((id) => id !== streamId));
  };

  const addSideStream = (streamId: string) => {
    if (!sideStreams.includes(streamId) && streamId !== mainStream) {
      setSideStreams((prev) => [...prev, streamId]);
    }
  };

  const removeSideStream = (streamId: string) => {
    setSideStreams((prev) => prev.filter((id) => id !== streamId));
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Collage Stream Viewer</h1>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="px-3 py-1 bg-gray-100 rounded-lg">
            <span className="text-sm font-mono">
              Status: {connectionStatus}
            </span>
          </div>
          <div className="px-3 py-1 bg-blue-100 rounded-lg">
            <span className="text-sm font-mono">
              Active Streams: {streams.filter((s) => s.isActive).length}
            </span>
          </div>
          <button
            onClick={refreshStreams}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Refresh Streams
          </button>
          <button
            onClick={playAllStreams}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Play All
          </button>
          <button
            onClick={stopAllStreams}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Stop All
          </button>
          <select
            value={layout}
            onChange={(e) =>
              setLayout(e.target.value as "main+side" | "grid" | "single")
            }
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <option value="main+side">Main + Side</option>
            <option value="grid">Grid</option>
            <option value="single">Single</option>
          </select>
        </div>

        {/* Debug Info */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-mono text-yellow-800">
            Debug: {debugInfo}
          </p>
        </div>
      </div>

      {streams.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📺</div>
          <h2 className="text-2xl font-semibold mb-2">No Streams Available</h2>
          <p className="text-gray-600 mb-4">
            Start streaming from another browser to see live streams here
          </p>
          <div className="bg-blue-50 p-4 rounded-lg max-w-md mx-auto">
            <h3 className="font-semibold mb-2">How to test:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>
                Open{" "}
                <code className="bg-gray-200 px-1 rounded">
                  http://localhost:3000/stream
                </code>{" "}
                in another browser
              </li>
              <li>Allow camera and microphone access</li>
              <li>Come back here and click "Refresh Streams"</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Video Canvas */}
          <div className="bg-black rounded-lg overflow-hidden shadow-lg">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-auto max-h-96 object-contain"
            />
          </div>

          {/* Stream Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Main Stream Selection */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Main Stream</h3>
              <select
                value={mainStream || ""}
                onChange={(e) => setMainStreamHandler(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select main stream</option>
                {streams
                  .filter((s) => s.isActive)
                  .map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {stream.name || `Stream ${stream.id.slice(0, 8)}`}
                    </option>
                  ))}
              </select>
            </div>

            {/* Side Streams */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Side Streams</h3>
              <div className="space-y-2">
                {streams
                  .filter((s) => s.isActive && s.id !== mainStream)
                  .map((stream) => (
                    <div key={stream.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={sideStreams.includes(stream.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            addSideStream(stream.id);
                          } else {
                            removeSideStream(stream.id);
                          }
                        }}
                      />
                      <span className="text-sm">
                        {stream.name || `Stream ${stream.id.slice(0, 8)}`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Layout Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Layout Info</h3>
              <div className="text-sm space-y-1">
                <p>
                  <strong>Current:</strong> {layout}
                </p>
                <p>
                  <strong>Main:</strong> {mainStream ? "Set" : "None"}
                </p>
                <p>
                  <strong>Side:</strong> {sideStreams.length} streams
                </p>
                <p>
                  <strong>Total:</strong>{" "}
                  {streams.filter((s) => s.isActive).length} active
                </p>
              </div>
            </div>
          </div>

          {/* Stream List */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Available Streams</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {streams.map((stream) => (
                <div
                  key={stream.id}
                  className={`p-3 border rounded-lg ${
                    mainStream === stream.id
                      ? "border-blue-500 bg-blue-50"
                      : sideStreams.includes(stream.id)
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        {stream.name || `Stream ${stream.id.slice(0, 8)}`}
                      </h4>
                      <p className="text-xs text-gray-600">{stream.id}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            stream.isActive ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        <span className="text-xs">
                          {stream.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setMainStreamHandler(stream.id)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Main
                      </button>
                      <button
                        onClick={() => addSideStream(stream.id)}
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                      >
                        Side
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Collage Features:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>
            <strong>Main + Side:</strong> One main stream with smaller side
            streams (like picture-in-picture)
          </li>
          <li>
            <strong>Grid:</strong> All streams in equal-sized grid layout
          </li>
          <li>
            <strong>Single:</strong> Focus on one stream at a time
          </li>
          <li>
            <strong>Real-time Canvas:</strong> Multiple video streams combined
            into one canvas
          </li>
          <li>
            <strong>Dynamic Layout:</strong> Automatically adjusts based on
            available streams
          </li>
          <li>
            <strong>Stream Management:</strong> Easy selection of main and side
            streams
          </li>
        </ul>
      </div>
    </div>
  );
}
