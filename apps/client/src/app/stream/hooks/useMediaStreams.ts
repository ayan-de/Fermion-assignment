import { useRef, useEffect } from "react";

export function useMediaStreams() {
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Get user media for local stream
    const getLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    getLocalStream();
  }, []);

  return {
    localVideo,
    remoteVideo,
  };
} 