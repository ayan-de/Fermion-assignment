// FFmpeg HLS transcoder logic
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as mediasoup from "mediasoup";

// Ensure HLS output directory exists
const HLS_OUTPUT_DIR = path.join(__dirname, "../public/hls");
if (!fs.existsSync(HLS_OUTPUT_DIR)) {
  fs.mkdirSync(HLS_OUTPUT_DIR, { recursive: true });
}

// Track used ports to avoid conflicts
const usedPorts = new Set<number>();
const activeStreams = new Map<string, HlsStream>(); // Track active streams

interface HlsStream {
  process: ChildProcess;
  streamId: string;
  outputDir: string;
  playlistUrl: string;
  rtpPort: number;
  consumer: mediasoup.types.Consumer;
  plainTransport: mediasoup.types.PlainTransport;
}

const getAvailablePort = (start = 10000, end = 59999): number => {
  for (let port = start; port <= end; port += 2) {
    // Use even ports only
    if (!usedPorts.has(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  throw new Error("No available ports");
};

/**
 * This is the main method where everything happens
 * Start FFmpeg process to convert RTP stream to HLS
 * @param producer - MediaSoup producer object
 * @param streamId - Unique identifier for the stream
 * @param router - MediaSoup router instance
 * @returns FFmpeg process and stream info
 */
const startHlsTranscoding = async (
  producer: mediasoup.types.Producer,
  streamId: string,
  router: mediasoup.types.Router
): Promise<HlsStream> => {
  // Check if stream already exists
  if (activeStreams.has(streamId)) {
    console.log(
      `Stream ${streamId} already exists, stopping previous instance`
    );
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

    // FFmpeg command to convert RTP to HLS
    const ffmpegArgs = [
      "-protocol_whitelist",
      "file,udp,rtp",
      "-i",
      sdpFilePath,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-profile:v",
      "baseline",
      "-level",
      "3.0",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-g",
      "60",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-b:a",
      "128k",
      "-hls_time",
      "2",
      "-hls_list_size",
      "10",
      "-hls_flags",
      "delete_segments+append_list",
      "-hls_segment_type",
      "mpegts",
      "-hls_segment_filename",
      path.join(streamOutputDir, "segment_%03d.ts"),
      path.join(streamOutputDir, "playlist.m3u8"),
    ];

    console.log(`Starting FFmpeg for stream ${streamId} with RTP input:`, ffmpegArgs.join(" "));

    // Spawn FFmpeg process
    const ffmpegProcess = spawn("ffmpeg", ffmpegArgs, {
      detached: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle FFmpeg output for debugging
    ffmpegProcess.stdout.on("data", (data) => {
      console.log(`FFmpeg stdout [${streamId}]: ${data}`);
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.log(`FFmpeg stderr [${streamId}]: ${data}`);
    });

    ffmpegProcess.on("close", (code) => {
      console.log(`FFmpeg process for stream ${streamId} exited with code ${code}`);
      // Clean up resources
      if (consumer) consumer.close();
      if (plainTransport) plainTransport.close();
      // Remove from active streams
      activeStreams.delete(streamId);
    });

    ffmpegProcess.on("error", (error) => {
      console.error(`FFmpeg process error for stream ${streamId}:`, error);
      // Clean up resources
      if (consumer) consumer.close();
      if (plainTransport) plainTransport.close();
      // Remove from active streams
      activeStreams.delete(streamId);
    });

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

    const hlsStream: HlsStream = {
      process: ffmpegProcess,
      streamId,
      outputDir: streamOutputDir,
      playlistUrl: `/hls/${streamId}/playlist.m3u8`,
      rtpPort,
      consumer,
      plainTransport,
    };

    // Add to active streams
    activeStreams.set(streamId, hlsStream);

    return hlsStream;

  } catch (error) {
    console.error(`Error starting HLS transcoding for stream ${streamId}:`, error);
    // Clean up port if it was allocated
    if ((error as any).rtpPort) {
      usedPorts.delete((error as any).rtpPort);
    }
    throw error;
  }
};

/**
 * Generate SDP file content for FFmpeg input
 * @param rtpParameters - MediaSoup RTP parameters
 * @param kind - 'audio' or 'video'
 * @param rtpPort - RTP port number
 * @returns SDP file content
 */
const generateSdpFile = (
  rtpParameters: mediasoup.types.RtpParameters,
  kind: string,
  rtpPort: number
): string => {
  const { codecs, encodings } = rtpParameters;
  const codec = codecs[0]; // Use the first codec

  // Basic SDP structure
  let sdp = "v=0\r\n";
  sdp += "o=- 0 0 IN IP4 127.0.0.1\r\n";
  sdp += "s=MediaSoup to HLS\r\n";
  sdp += "c=IN IP4 127.0.0.1\r\n";
  sdp += "t=0 0\r\n";

  // Media section
  sdp += `m=${kind} ${rtpPort} RTP/AVP ${codec.payloadType}\r\n`;
  sdp += `a=rtpmap:${codec.payloadType} ${codec.mimeType.split("/")[1]}/${
    codec.clockRate
  }\r\n`;

  // Add specific parameters for the codec
  if (codec.parameters) {
    for (const [key, value] of Object.entries(codec.parameters)) {
      sdp += `a=fmtp:${codec.payloadType} ${key}=${value}\r\n`;
    }
  }

  // Add encoding parameters
  if (encodings && encodings.length > 0) {
    const encoding = encodings[0];
    if (encoding.ssrc) {
      sdp += `a=ssrc:${encoding.ssrc} cname:mediasoup\r\n`;
    }
  }

  return sdp;
};

/**
 * Stop HLS transcoding and clean up resources
 * @param hlsStream - HLS stream object returned by startHlsTranscoding
 */
const stopHlsTranscoding = (hlsStream: HlsStream): void => {
  if (!hlsStream) return;

  console.log(`Stopping HLS transcoding for stream ${hlsStream.streamId}`);

  // Kill FFmpeg process
  if (hlsStream.process) {
    hlsStream.process.kill("SIGTERM");
  }

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
    usedPorts.delete(hlsStream.rtpPort);
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
const isHlsStreamReady = (streamId: string): boolean => {
  const playlistPath = path.join(HLS_OUTPUT_DIR, streamId, "playlist.m3u8");
  return fs.existsSync(playlistPath);
};

/**
 * Get the HLS stream URL
 * @param streamId - Stream ID
 * @returns HLS stream URL
 */
const getHlsStreamUrl = (streamId: string): string => {
  return `/hls/${streamId}/playlist.m3u8`;
};

/**
 * Get all active streams
 * @returns Array of active stream IDs
 */
const getActiveStreams = (): string[] => {
  return Array.from(activeStreams.keys());
};

export {
  startHlsTranscoding,
  stopHlsTranscoding,
  isHlsStreamReady,
  getHlsStreamUrl,
  getActiveStreams,
  type HlsStream,
}; 