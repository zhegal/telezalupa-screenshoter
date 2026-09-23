import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { FrameFingerprintService } from './frame-fingerprint.service.js';

async function solidImage(width: number, height: number, color: string): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

test('creates the same fingerprint for the same normalized RGB pixels', async () => {
  const service = new FrameFingerprintService();
  const small = await solidImage(320, 180, '#ff0000');
  const large = await solidImage(1280, 720, '#ff0000');

  assert.equal(await service.createHash(small), await service.createHash(large));
});

test('creates different fingerprints for different normalized RGB pixels', async () => {
  const service = new FrameFingerprintService();
  const red = await solidImage(320, 180, '#ff0000');
  const blue = await solidImage(320, 180, '#0000ff');

  assert.notEqual(await service.createHash(red), await service.createHash(blue));
});
