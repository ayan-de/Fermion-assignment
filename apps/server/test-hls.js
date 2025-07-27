const { startHlsTranscoding, stopHlsTranscoding } = require("./src/ffmpeg");

async function testHlsCreation() {
  console.log("Testing HLS creation...");

  try {
    // Create a mock producer object
    const mockProducer = {
      id: "test-producer-123",
      kind: "video",
    };

    const mockRouter = {};
    const streamId = "test-stream-" + Date.now();

    console.log(`Starting HLS transcoding for stream: ${streamId}`);

    const hlsStream = await startHlsTranscoding(
      mockProducer,
      streamId,
      mockRouter
    );

    console.log("HLS stream created:", hlsStream);

    // Wait for 10 seconds to see if files are created
    setTimeout(() => {
      console.log("Checking for HLS files...");
      const fs = require("fs");
      const path = require("path");

      const streamDir = path.join(__dirname, "public/hls", streamId);
      const playlistPath = path.join(streamDir, "playlist.m3u8");

      if (fs.existsSync(playlistPath)) {
        console.log("✅ HLS playlist created successfully!");
        console.log("Playlist path:", playlistPath);

        // List all files in the directory
        const files = fs.readdirSync(streamDir);
        console.log("Files in stream directory:", files);
      } else {
        console.log("❌ HLS playlist not created");
      }

      // Stop the stream
      stopHlsTranscoding(hlsStream);
      console.log("Test completed");
      process.exit(0);
    }, 10000);
  } catch (error) {
    console.error("Error in test:", error);
    process.exit(1);
  }
}

testHlsCreation();
