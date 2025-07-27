import * as mediasoup from "mediasoup";

/**
 * Generate SDP file content for FFmpeg input
 * @param rtpParameters - MediaSoup RTP parameters
 * @param kind - 'audio' or 'video'
 * @param rtpPort - RTP port number
 * @returns SDP file content
 */
export const generateSdpFile = (
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