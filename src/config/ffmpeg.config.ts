export const FFMPEG_CONFIG = Symbol('FFMPEG_CONFIG');

export interface FfmpegConfig {
  watchdogMs: number;
  frameDelaySeconds: number;
  rwTimeoutUs: number;
}

export function createFfmpegConfig(): FfmpegConfig {
  return {
    watchdogMs: 60000,
    frameDelaySeconds: 10,
    rwTimeoutUs: 15000000,
  };
}
