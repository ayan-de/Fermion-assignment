# 🎬 Fermion Assignment Demo Guide

This guide will help you test and demonstrate the real-time video streaming application.

## 🚀 Quick Demo Steps

### Step 1: Start the Application
Both services should already be running:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000

### Step 2: Test Streaming (WebRTC)
1. Open http://localhost:3000 in your browser
2. Click the **"Stream"** button
3. Allow camera and microphone access
4. You should see your video stream displayed
5. Check the browser console for connection status

### Step 3: Test Multi-user Streaming
1. Open a new incognito window/tab
2. Navigate to http://localhost:3000/stream
3. Allow camera access in the new window
4. Both windows should now show each other's streams
5. You can see real-time video communication working

### Step 4: Test HLS Watching
1. Open http://localhost:3000/watch in a new tab
2. Click **"Refresh Streams"** button
3. You should see available streams listed
4. Click on any stream to start watching
5. The stream will play using HLS format

### Step 5: Verify HLS Files
1. Check the server's HLS directory:
   ```bash
   cd apps/server/public/hls
   ls -la
   ```
2. You should see directories for each active stream
3. Each directory contains:
   - `playlist.m3u8` - HLS playlist file
   - `segment_000.ts`, `segment_001.ts`, etc. - Video segments

## 🧪 Testing Scenarios

### Scenario 1: Single User Streaming
- Start streaming in one browser
- Verify local video display
- Check server logs for HLS transcoding

### Scenario 2: Multi-user Communication
- Start streaming in 2+ browsers
- Verify each user sees others' streams
- Test real-time communication

### Scenario 3: HLS Playback
- Start streaming in one browser
- Open watch page in another browser
- Verify HLS stream playback
- Test stream switching

### Scenario 4: Connection Management
- Start streaming in multiple browsers
- Close one browser window
- Verify other users see the disconnection
- Check HLS stream cleanup

## 🔍 Debug Information

### Frontend Console
Check browser console for:
- WebSocket connection status
- MediaSoup device loading
- Transport creation/connection
- Producer/consumer events

### Backend Logs
Check server terminal for:
- Client connections/disconnections
- MediaSoup worker creation
- Transport creation
- HLS transcoding status
- FFmpeg process management

### Network Tab
Check browser Network tab for:
- WebSocket connections
- HLS playlist requests
- Video segment downloads

## 📊 Expected Behavior

### When Starting a Stream:
1. ✅ WebSocket connection established
2. ✅ MediaSoup device loaded
3. ✅ Producer transport created
4. ✅ Camera/microphone access granted
5. ✅ Local video displayed
6. ✅ HLS transcoding started
7. ✅ Other users notified

### When Watching Streams:
1. ✅ WebSocket connection established
2. ✅ Available streams list retrieved
3. ✅ HLS.js library loaded
4. ✅ Stream selected and played
5. ✅ Video segments downloaded
6. ✅ Smooth playback achieved

## 🐛 Common Issues & Solutions

### Issue: Camera not working
**Solution**: 
- Ensure you're on localhost or HTTPS
- Check browser permissions
- Try refreshing the page

### Issue: No streams showing in watch page
**Solution**:
- Make sure someone is actively streaming
- Click "Refresh Streams" button
- Check server logs for HLS transcoding

### Issue: HLS not playing
**Solution**:
- Verify FFmpeg is installed: `ffmpeg -version`
- Check browser console for HLS.js errors
- Ensure HLS files exist in server/public/hls/

### Issue: Connection errors
**Solution**:
- Verify both services are running
- Check ports 3000 and 4000 are available
- Restart both frontend and backend

## 🎯 Success Criteria

✅ **Real-time streaming works** - Users can stream and see each other  
✅ **HLS transcoding works** - Streams are converted to HLS format  
✅ **Multi-user support** - Multiple users can connect simultaneously  
✅ **Stream discovery** - Available streams are listed and playable  
✅ **Error handling** - Graceful handling of connection issues  
✅ **Cross-browser compatibility** - Works in Chrome, Firefox, Safari  

## 📝 Demo Script

Here's a suggested demo flow:

1. **Introduction** (30 seconds)
   - "This is a real-time video streaming application built with WebRTC and MediaSoup"
   - "It supports both live streaming and HLS transcoding for broader compatibility"

2. **Live Streaming Demo** (1 minute)
   - Open http://localhost:3000/stream
   - Show camera access and local video
   - "This demonstrates real-time WebRTC streaming"

3. **Multi-user Demo** (1 minute)
   - Open second browser window
   - Show both users seeing each other
   - "Multiple users can connect and see each other's streams in real-time"

4. **HLS Watching Demo** (1 minute)
   - Open http://localhost:3000/watch
   - Show available streams list
   - Play an HLS stream
   - "This shows HLS transcoding for broader device compatibility"

5. **Technical Overview** (30 seconds)
   - "The application uses MediaSoup for WebRTC handling"
   - "FFmpeg automatically transcodes streams to HLS format"
   - "Socket.IO manages real-time communication"

This demo showcases all the key features of the assignment! 