const {
  startHlsTranscoding,
  stopHlsTranscoding,
  getActiveStreams,
} = require("./src/ffmpeg");

async function testMultipleStreams() {
  console.log("Testing multiple HLS streams...");

  try {
    // Create mock producer objects
    const mockProducer1 = {
      id: "test-producer-1",
      kind: "video",
    };

    const mockProducer2 = {
      id: "test-producer-2",
      kind: "video",
    };

    const mockRouter = {};
    const streamId1 = "test-stream-1-" + Date.now();
    const streamId2 = "test-stream-2-" + Date.now();

    console.log(`Starting first stream: ${streamId1}`);
    const hlsStream1 = await startHlsTranscoding(
      mockProducer1,
      streamId1,
      mockRouter
    );
    console.log("First stream created:", hlsStream1);

    // Wait a bit before creating second stream
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(`Starting second stream: ${streamId2}`);
    const hlsStream2 = await startHlsTranscoding(
      mockProducer2,
      streamId2,
      mockRouter
    );
    console.log("Second stream created:", hlsStream2);

    // Check active streams
    const activeStreams = getActiveStreams();
    console.log("Active streams:", activeStreams);

    // Wait for 10 seconds to see if files are created
    setTimeout(() => {
      console.log("Checking for HLS files...");
      const fs = require("fs");
      const path = require("path");

      const playlistPath1 = path.join(
        __dirname,
        "public/hls",
        streamId1,
        "playlist.m3u8"
      );
      const playlistPath2 = path.join(
        __dirname,
        "public/hls",
        streamId2,
        "playlist.m3u8"
      );

      if (fs.existsSync(playlistPath1)) {
        console.log("✅ First HLS playlist created successfully!");
      } else {
        console.log("❌ First HLS playlist not created");
      }

      if (fs.existsSync(playlistPath2)) {
        console.log("✅ Second HLS playlist created successfully!");
      } else {
        console.log("❌ Second HLS playlist not created");
      }

      // Stop the streams
      stopHlsTranscoding(hlsStream1);
      stopHlsTranscoding(hlsStream2);
      console.log("Test completed");
      process.exit(0);
    }, 10000);
  } catch (error) {
    console.error("Error in test:", error);
    process.exit(1);
  }
}

testMultipleStreams();
