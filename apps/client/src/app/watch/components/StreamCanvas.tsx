import { useEffect, useRef } from "react";

import { HlsStream, LayoutType } from "../../shared/types";

interface StreamCanvasProps {
  layout: LayoutType;
  mainStream: string | null;
  sideStreams: string[];
  streams: HlsStream[];
}

export function StreamCanvas({
  layout,
  mainStream,
  sideStreams,
  streams,
}: StreamCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

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

  return (
    <div className="bg-black rounded-lg overflow-hidden shadow-lg">
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-auto max-h-96 object-contain"
      />
    </div>
  );
}
