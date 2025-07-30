import { forwardRef } from "react";

interface VideoPlayerProps {
  title: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ title, videoRef, className = "", ...videoProps }, ref) => {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold text-white">{title}</h2>
        <video
          ref={videoRef}
          className={`w-full max-w-md border shadow rounded-lg ${className}`}
          {...videoProps}
        />
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
