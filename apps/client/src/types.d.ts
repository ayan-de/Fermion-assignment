export {};


declare global {
  interface Window {
    localStream: MediaStream;
  }
}
