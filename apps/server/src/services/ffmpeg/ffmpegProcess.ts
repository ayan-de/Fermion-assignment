import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { HlsStream } from "../../types";
import { releasePort } from "./portManager";

/**
 * Start FFmpeg process for HLS transcoding
 * @param streamId - Unique identifier for the stream
 * @param sdpFilePath - Path to the SDP file
 * @param streamOutputDir - Output directory for HLS files
 * @param hlsStream - HLS stream object to update
 * @returns FFmpeg process
 */
export const startFfmpegProcess = (
  streamId: string,
  sdpFilePath: string,
  streamOutputDir: string,
  hlsStream: HlsStream
): ChildProcess => {
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
    cleanupFfmpegResources(hlsStream);
  });

  ffmpegProcess.on("error", (error) => {
    console.error(`FFmpeg process error for stream ${streamId}:`, error);
    cleanupFfmpegResources(hlsStream);
  });

  return ffmpegProcess;
};

/**
 * Clean up FFmpeg resources when process ends
 * @param hlsStream - HLS stream object
 */
const cleanupFfmpegResources = (hlsStream: HlsStream): void => {
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
};

/**
 * Stop FFmpeg process
 * @param hlsStream - HLS stream object
 */
export const stopFfmpegProcess = (hlsStream: HlsStream): void => {
  if (hlsStream.process) {
    hlsStream.process.kill("SIGTERM");
  }
}; 