import * as fs from "fs";
import * as path from "path";
import * as mediasoup from "mediasoup";
import { HlsStream } from "../../types";
import { getAvailablePort, releasePort } from "./portManager";
import { generateSdpFile } from "./sdpGenerator";
import { startFfmpegProcess, stopFfmpegProcess } from "./ffmpegProcess";

// Ensure HLS output directory exists
const HLS_OUTPUT_DIR = path.join(__dirname, "../../../public/hls");
if (!fs.existsSync(HLS_OUTPUT_DIR)) {
  fs.mkdirSync(HLS_OUTPUT_DIR, { recursive: true });
}

// Track active streams
const activeStreams = new Map<string, HlsStream>();

/**
 * Start HLS transcoding for a producer
 * @param producer - MediaSoup producer object
 * @param streamId - Unique identifier for the stream
 * @param router - MediaSoup router instance
 * @returns HLS stream object
 */
export const startHlsTranscoding = async (
  producer: mediasoup.types.Producer,
  streamId: string,
  router: mediasoup.types.Router
): Promise<HlsStream> => {
  // Check if stream already exists
  if (activeStreams.has(streamId)) {
    console.log(`Stream ${streamId} already exists, stopping previous instance`);
    await stopHlsTranscoding(activeStreams.get(streamId)!);
  }

  // Create a directory for this specific stream
  const streamOutputDir = path.join(HLS_OUTPUT_DIR, streamId);
  if (!fs.existsSync(streamOutputDir)) {
    fs.mkdirSync(streamOutputDir, { recursive: true });
  }

  try {
    // Get a unique RTP port for this stream
    const rtpPort = getAvailablePort();
    console.log(`Allocated port ${rtpPort} for stream ${streamId}`);

    // Create a plain transport for RTP output
    const plainTransport = await router.createPlainTransport({
      listenIp: { ip: "127.0.0.1", announcedIp: undefined },
      rtcpMux: false,
      comedia: false,
    });

    console.log(`Created plain transport for HLS: ${plainTransport.id}`);

    // Create a consumer from the producer
    const consumer = await plainTransport.consume({
      producerId: producer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: false,
    });

    console.log(`Created consumer for HLS: ${consumer.id}`);

    // Create SDP file for FFmpeg input
    const sdpContent = generateSdpFile(
      consumer.rtpParameters,
      producer.kind,
      rtpPort
    );
    const sdpFilePath = path.join(streamOutputDir, "input.sdp");
    fs.writeFileSync(sdpFilePath, sdpContent);

    console.log(`SDP file created at: ${sdpFilePath}`);

    // Connect the plain transport to the RTP port
    await plainTransport.connect({
      ip: "127.0.0.1",
      port: rtpPort,
      rtcpPort: rtpPort + 1,
    });

    console.log(`Plain transport connected to RTP port ${rtpPort}`);

    // Create HLS stream object
    const hlsStream: HlsStream = {
      process: null as any,
      streamId,
      outputDir: streamOutputDir,
      playlistUrl: `/hls/${streamId}/playlist.m3u8`,
      rtpPort,
      consumer,
      plainTransport,
    };

    // Start FFmpeg process
    hlsStream.process = startFfmpegProcess(
      streamId,
      sdpFilePath,
      streamOutputDir,
      hlsStream
    );

    // Set up a timer to check if HLS files are being created
    const checkHlsFiles = setInterval(() => {
      const playlistPath = path.join(streamOutputDir, "playlist.m3u8");
      if (fs.existsSync(playlistPath)) {
        console.log(`HLS playlist created for stream ${streamId}: ${playlistPath}`);
        clearInterval(checkHlsFiles);
      }
    }, 2000);

    // Clear the interval after 30 seconds if no files are created
    setTimeout(() => {
      clearInterval(checkHlsFiles);
      const playlistPath = path.join(streamOutputDir, "playlist.m3u8");
      if (!fs.existsSync(playlistPath)) {
        console.error(`HLS playlist not created for stream ${streamId} within 30 seconds`);
      }
    }, 30000);

    // Add to active streams
    activeStreams.set(streamId, hlsStream);

    return hlsStream;

  } catch (error) {
    console.error(`Error starting HLS transcoding for stream ${streamId}:`, error);
    // Clean up port if it was allocated
    if ((error as any).rtpPort) {
      releasePort((error as any).rtpPort);
    }
    throw error;
  }
};

/**
 * Stop HLS transcoding and clean up resources
 * @param hlsStream - HLS stream object returned by startHlsTranscoding
 */
export const stopHlsTranscoding = (hlsStream: HlsStream): void => {
  if (!hlsStream) return;

  console.log(`Stopping HLS transcoding for stream ${hlsStream.streamId}`);

  // Stop FFmpeg process
  stopFfmpegProcess(hlsStream);

  // Close consumer
  if (hlsStream.consumer) {
    hlsStream.consumer.close();
  }

  // Close plain transport
  if (hlsStream.plainTransport) {
    hlsStream.plainTransport.close();
  }

  // Release the port
  if (hlsStream.rtpPort) {
    releasePort(hlsStream.rtpPort);
  }

  // Remove from active streams
  activeStreams.delete(hlsStream.streamId);

  console.log(`Stopped HLS transcoding for stream ${hlsStream.streamId}`);
};

/**
 * Check if HLS stream is ready
 * @param streamId - Stream ID
 * @returns Whether the stream is ready
 */
export const isHlsStreamReady = (streamId: string): boolean => {
  const playlistPath = path.join(HLS_OUTPUT_DIR, streamId, "playlist.m3u8");
  return fs.existsSync(playlistPath);
};

/**
 * Get the HLS stream URL
 * @param streamId - Stream ID
 * @returns HLS stream URL
 */
export const getHlsStreamUrl = (streamId: string): string => {
  return `/hls/${streamId}/playlist.m3u8`;
};

/**
 * Get all active streams
 * @returns Array of active stream IDs
 */
export const getActiveStreams = (): string[] => {
  return Array.from(activeStreams.keys());
}; 