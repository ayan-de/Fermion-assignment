# Fermion Assignment - Real-time Video Streaming Application

A sophisticated real-time video streaming application built with WebRTC, MediaSoup, and HLS transcoding.

## 🚀 Features

- **Real-time Video Streaming**: Stream your camera/microphone using WebRTC
- **Multi-user Support**: Multiple users can connect and see each other's streams
- **HLS Transcoding**: Automatic conversion of WebRTC streams to HLS format
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- **Cross-platform Compatibility**: Works on desktop and mobile browsers

## 🏗️ Architecture

- **Frontend**: Next.js 15 with React 19, TypeScript, and Tailwind CSS
- **Backend**: Node.js with Express, Socket.IO, and MediaSoup
- **Real-time Communication**: WebRTC via MediaSoup
- **Video Processing**: FFmpeg for HLS (HTTP Live Streaming) transcoding

## 📁 Project Structure

```
Fermion-assignment/
├── apps/
│   ├── client/          # Next.js frontend application
│   │   ├── src/app/
│   │   │   ├── page.tsx        # Main landing page
│   │   │   ├── stream/page.tsx # Video streaming interface
│   │   │   └── watch/page.tsx  # HLS stream watching interface
│   │   └── package.json
│   └── server/          # Node.js backend application
│       ├── src/
│       │   ├── index.ts           # Main server entry point
│       │   ├── mediasoupServer.ts # MediaSoup WebRTC logic
│       │   └── ffmpeg.ts          # FFmpeg HLS transcoding
│       └── package.json
```

## 🛠️ Prerequisites

- Node.js 18+ 
- FFmpeg (for HLS transcoding)
- Modern browser with WebRTC support

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
cd apps/server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Start the Services

```bash
# Start the backend server (in one terminal)
cd apps/server
npm run start

# Start the frontend (in another terminal)
cd apps/client
npm run dev
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000

## 📖 How to Use

### Streaming (WebRTC)

1. Open http://localhost:3000 in your browser
2. Click the **"Stream"** button
3. Allow camera and microphone access when prompted
4. Your video stream will be displayed locally
5. Other users can see your stream in real-time

### Watching HLS Streams

1. Open http://localhost:3000/watch in your browser
2. Click **"Refresh Streams"** or "**Refresh Page"** to see available streams
3. Click on any stream in the list to start watching
4. The stream will play using HLS.js for optimal compatibility

### Multi-user Testing

1. Open multiple browser windows or incognito tabs
2. Navigate to http://localhost:3000/stream in each
3. Allow camera access in each window
4. Each user will see their own stream and other users' streams
5. Check the watch page to see HLS versions of the streams

## 📄 License

This project is part of the Fermion assignment. 