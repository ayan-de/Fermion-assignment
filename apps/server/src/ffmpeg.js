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
    // For now, let's create a simple test HLS stream
    // This will be replaced with actual transcoding later
    console.log(`Creating test HLS stream for ${streamId}`);

    // Create a simple test video using FFmpeg
    const ffmpegArgs = [
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=3600:size=640x480:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=3600",
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

    console.log("Starting FFmpeg with test source:", ffmpegArgs.join(" "));

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
      rtpPort: null,
      consumer: null,
      plainTransport: null,
    };
  } catch (error) {
    console.error("Error starting HLS transcoding:", error);
    throw error;
  }
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
