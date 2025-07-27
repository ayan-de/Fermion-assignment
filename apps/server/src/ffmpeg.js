//FFmpeg HLS transcoder logic
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Ensure HLS output directory exists
const HLS_OUTPUT_DIR = path.join(__dirname, "../public/hls");
if (!fs.existsSync(HLS_OUTPUT_DIR)) {
  fs.mkdirSync(HLS_OUTPUT_DIR, { recursive: true });
}

// Track used ports to avoid conflicts
const usedPorts = new Set();
const getAvailablePort = (start = 10000, end = 59999) => {
  for (let port = start; port <= end; port++) {
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
 * @param {Object} producer - MediaSoup producer object
 * @param {string} streamId - Unique identifier for the stream
 * @param {Object} router - MediaSoup router instance
 * @returns {Object} - FFmpeg process and stream info
 */
const startHlsTranscoding = async (producer, streamId, router) => {
  // Create a directory for this specific stream
  const streamOutputDir = path.join(HLS_OUTPUT_DIR, streamId);
  if (!fs.existsSync(streamOutputDir)) {
    fs.mkdirSync(streamOutputDir, { recursive: true });
  }

  try {
    // Get a unique RTP port for this stream
    const rtpPort = getAvailablePort();

    // Create a plain transport for RTP output
    const plainTransport = await router.createPlainTransport({
      listenIp: { ip: "127.0.0.1", announcedIp: null },
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

    console.log("Starting FFmpeg with RTP input:", ffmpegArgs.join(" "));

    // Spawn FFmpeg process
    const ffmpegProcess = spawn("ffmpeg", ffmpegArgs, {
      detached: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle FFmpeg output for debugging
    ffmpegProcess.stdout.on("data", (data) => {
      console.log(`FFmpeg stdout: ${data}`);
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.log(`FFmpeg stderr: ${data}`);
    });

    ffmpegProcess.on("close", (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      // Clean up resources
      if (consumer) consumer.close();
      if (plainTransport) plainTransport.close();
    });

    // Set up a timer to check if HLS files are being created
    const checkHlsFiles = setInterval(() => {
      const playlistPath = path.join(streamOutputDir, "playlist.m3u8");
      if (fs.existsSync(playlistPath)) {
        console.log(`HLS playlist created: ${playlistPath}`);
        clearInterval(checkHlsFiles);
      }
    }, 2000);

    // Clear the interval after 30 seconds if no files are created
    setTimeout(() => {
      clearInterval(checkHlsFiles);
    }, 30000);

    return {
      process: ffmpegProcess,
      streamId,
      outputDir: streamOutputDir,
      playlistUrl: `/hls/${streamId}/playlist.m3u8`,
      rtpPort,
      consumer,
      plainTransport,
    };
  } catch (error) {
    console.error("Error starting HLS transcoding:", error);
    throw error;
  }
};

/**
 * Generate SDP file content for FFmpeg input
 * @param {Object} rtpParameters - MediaSoup RTP parameters
 * @param {string} kind - 'audio' or 'video'
 * @param {number} rtpPort - RTP port number
 * @returns {string} - SDP file content
 */
const generateSdpFile = (rtpParameters, kind, rtpPort) => {
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
 * @param {Object} hlsStream - HLS stream object returned by startHlsTranscoding
 */
const stopHlsTranscoding = (hlsStream) => {
  if (!hlsStream) return;

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

  console.log(`Stopped HLS transcoding for stream ${hlsStream.streamId}`);
};

/**
 * Check if HLS stream is ready
 * @param {string} streamId - Stream ID
 * @returns {boolean} - Whether the stream is ready
 */
const isHlsStreamReady = (streamId) => {
  const playlistPath = path.join(HLS_OUTPUT_DIR, streamId, "playlist.m3u8");
  return fs.existsSync(playlistPath);
};

/**
 * Get the HLS stream URL
 * @param {string} streamId - Stream ID
 * @returns {string} - HLS stream URL
 */
const getHlsStreamUrl = (streamId) => {
  return `/hls/${streamId}/playlist.m3u8`;
};

module.exports = {
  startHlsTranscoding,
  stopHlsTranscoding,
  isHlsStreamReady,
  getHlsStreamUrl,
};
