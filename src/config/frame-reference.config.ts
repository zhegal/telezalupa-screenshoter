import { join } from 'node:path';

export const FRAME_REFERENCE_CONFIG = Symbol('FRAME_REFERENCE_CONFIG');

export interface FrameReferenceConfig {
  directory: string;
  maxUploadBytes: number;
}

export function createFrameReferenceConfig(): FrameReferenceConfig {
  return {
    directory:
      process.env.FORBIDDEN_REFERENCES_DIR ||
      join(process.cwd(), 'data', 'forbidden-frame-references'),
    maxUploadBytes: 10 * 1024 * 1024,
  };
}
