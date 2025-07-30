"use client";
import { useEffect, useRef, useState } from "react";
import { useWebRTCConnection } from "./hooks/useWebRTCConnection";
import { useMediaStreams } from "./hooks/useMediaStreams";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { VideoPlayer } from "./components/VideoPlayer";

export default function StreamPage() {
  const { connectionStatus, isConnected } = useWebRTCConnection();
  const { localVideo, remoteVideo } = useMediaStreams();

  return (
    <div className="p-4 flex flex-col">
      <ConnectionStatus status={connectionStatus} />

      <VideoPlayer
        title="🟢 Local Stream"
        videoRef={localVideo}
        autoPlay
        muted
        playsInline
        className="w-full max-w-md border shadow rounded-lg mb-6"
      />

      <VideoPlayer
        title="🔴 Remote Stream"
        videoRef={remoteVideo}
        autoPlay
        playsInline
        className="w-full max-w-md border shadow rounded-lg"
      />

      <p className="mt-4 text-sm text-gray-600">
        Open this page in another browser window or incognito mode to see the
        remote stream.
      </p>
    </div>
  );
}
