export const RTC_CONFIG = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
}

export const CHUNK_SIZE = 64 * 1024       // 64 KB
export const BUFFER_LOW = 512 * 1024      // 512 KB
export const CONNECT_TIMEOUT_MS = 30_000