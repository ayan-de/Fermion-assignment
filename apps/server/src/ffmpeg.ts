// Re-export FFmpeg service functions for backward compatibility
export {
  startHlsTranscoding,
  stopHlsTranscoding,
  isHlsStreamReady,
  getHlsStreamUrl,
  getActiveStreams,
} from "./services/ffmpeg"; 