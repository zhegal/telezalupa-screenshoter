import assert from 'node:assert/strict';
import { mkdtemp, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { FrameFingerprintService } from './frame-fingerprint.service.js';
import { ForbiddenFrameReferenceService } from './forbidden-frame-reference.service.js';

interface ReferenceRow {
  id: string;
  label: string;
  thumbnailHash: string;
  previewPath: string;
  createdAt: Date;
  updatedAt: Date;
}

function createPrismaMock() {
  const rows = new Map<string, ReferenceRow>();

  return {
    forbiddenFrameReference: {
      findMany: async (args?: { select?: { thumbnailHash?: boolean } }) => {
        const values = [...rows.values()];
        return args?.select ? values.map(({ thumbnailHash }) => ({ thumbnailHash })) : values;
      },
      findUnique: async ({ where }: { where: { id?: string; thumbnailHash?: string } }) => {
        if (where.id) {
          return rows.get(where.id) ?? null;
        }

        return [...rows.values()].find((row) => row.thumbnailHash === where.thumbnailHash) ?? null;
      },
      create: async ({
        data,
      }: {
        data: Pick<ReferenceRow, 'label' | 'thumbnailHash' | 'previewPath'>;
      }) => {
        const now = new Date();
        const row = { id: `reference-${rows.size + 1}`, ...data, createdAt: now, updatedAt: now };
        rows.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: { label: string } }) => {
        const row = { ...rows.get(where.id)!, ...data, updatedAt: new Date() };
        rows.set(where.id, row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = rows.get(where.id)!;
        rows.delete(where.id);
        return row;
      },
    },
  };
}

test('creates, caches, renames, previews, and deletes a forbidden reference', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'forbidden-frame-reference-'));
  const prisma = createPrismaMock();
  const fingerprint = new FrameFingerprintService();
  const service = new ForbiddenFrameReferenceService(
    { directory, maxUploadBytes: 10 * 1024 * 1024 },
    prisma as never,
    fingerprint,
  );
  await service.onModuleInit();
  const buffer = await sharp({
    create: { width: 320, height: 180, channels: 3, background: '#000000' },
  })
    .png()
    .toBuffer();

  const created = await service.create(' Black screen ', {
    buffer,
    mimetype: 'image/png',
    originalname: 'black.png',
    size: buffer.length,
  });

  assert.equal(created.label, 'Black screen');
  assert.equal(service.isForbidden(created.thumbnailHash), true);
  assert.ok((await service.getPreview(created.id)).length > 0);
  await assert.rejects(
    service.create('Duplicate', {
      buffer,
      mimetype: 'image/png',
      originalname: 'black-again.png',
      size: buffer.length,
    }),
    /already exists/,
  );
  assert.equal((await readdir(directory)).length, 1);

  const renamed = await service.updateLabel(created.id, 'OTT placeholder');
  assert.equal(renamed.label, 'OTT placeholder');

  const [storedFile] = await readdir(directory);
  const storedPath = join(directory, storedFile);
  await service.delete(created.id);
  assert.equal(service.isForbidden(created.thumbnailHash), false);
  await assert.rejects(stat(storedPath));
});
