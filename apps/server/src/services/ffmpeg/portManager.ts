// Port management for FFmpeg RTP streams
const usedPorts = new Set<number>();

export const getAvailablePort = (start = 10000, end = 59999): number => {
  for (let port = start; port <= end; port += 2) {
    // Use even ports only
    if (!usedPorts.has(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  throw new Error("No available ports");
};

export const releasePort = (port: number): void => {
  usedPorts.delete(port);
}; 