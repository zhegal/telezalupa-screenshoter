import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export const FRAME_THUMBNAIL_WIDTH = 32;
export const FRAME_THUMBNAIL_HEIGHT = 18;

export interface FrameReferenceAssets {
  hash: string;
  preview: Buffer;
}

@Injectable()
export class FrameFingerprintService {
  async createHash(image: Buffer): Promise<string> {
    const pixels = await sharp(image)
      .rotate()
      .flatten({ background: '#000000' })
      .toColourspace('srgb')
      .resize(FRAME_THUMBNAIL_WIDTH, FRAME_THUMBNAIL_HEIGHT, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .removeAlpha()
      .raw()
      .toBuffer();

    return createHash('sha256').update(pixels).digest('hex');
  }

  async createReferenceAssets(image: Buffer): Promise<FrameReferenceAssets> {
    const hash = await this.createHash(image);
    const preview = await sharp(image)
      .rotate()
      .flatten({ background: '#000000' })
      .toColourspace('srgb')
      .resize(640, 360, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    return { hash, preview };
  }
}
