import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  FRAME_REFERENCE_CONFIG,
  type FrameReferenceConfig,
} from '../config/frame-reference.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FrameFingerprintService } from './frame-fingerprint.service.js';
import type {
  ForbiddenFrameReferenceDto,
  ForbiddenFrameUpload,
} from './forbidden-frame-reference.types.js';

const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ForbiddenFrameReferenceService implements OnModuleInit {
  private readonly hashes = new Set<string>();

  constructor(
    @Inject(FRAME_REFERENCE_CONFIG) private readonly config: FrameReferenceConfig,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FrameFingerprintService) private readonly fingerprint: FrameFingerprintService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reloadCache();
  }

  async list(): Promise<ForbiddenFrameReferenceDto[]> {
    const items = await this.prisma.forbiddenFrameReference.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });

    return items.map((item) => this.toDto(item));
  }

  async create(label: unknown, file?: ForbiddenFrameUpload): Promise<ForbiddenFrameReferenceDto> {
    const normalizedLabel = this.normalizeLabel(label);
    this.validateFile(file);

    let assets: Awaited<ReturnType<FrameFingerprintService['createReferenceAssets']>>;

    try {
      assets = await this.fingerprint.createReferenceAssets(file.buffer);
    } catch {
      throw new BadRequestException('Uploaded file is not a supported image');
    }

    const existing = await this.prisma.forbiddenFrameReference.findUnique({
      where: { thumbnailHash: assets.hash },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('This forbidden frame reference already exists');
    }

    await mkdir(this.config.directory, { recursive: true });
    const previewPath = `${randomUUID()}.webp`;
    const absolutePath = this.getAbsolutePreviewPath(previewPath);
    await writeFile(absolutePath, assets.preview);

    try {
      const created = await this.prisma.forbiddenFrameReference.create({
        data: {
          label: normalizedLabel,
          thumbnailHash: assets.hash,
          previewPath,
        },
      });
      this.hashes.add(created.thumbnailHash);
      return this.toDto(created);
    } catch (err) {
      await unlink(absolutePath).catch(() => undefined);
      throw err;
    }
  }

  async updateLabel(id: string, label: unknown): Promise<ForbiddenFrameReferenceDto> {
    await this.requireReference(id);
    const updated = await this.prisma.forbiddenFrameReference.update({
      where: { id },
      data: { label: this.normalizeLabel(label) },
    });

    return this.toDto(updated);
  }

  async delete(id: string): Promise<{ deleted: true }> {
    const reference = await this.requireReference(id);
    await this.prisma.forbiddenFrameReference.delete({ where: { id } });
    this.hashes.delete(reference.thumbnailHash);
    await unlink(this.getAbsolutePreviewPath(reference.previewPath)).catch(() => undefined);

    return { deleted: true };
  }

  async getPreview(id: string): Promise<Buffer> {
    const reference = await this.requireReference(id);

    try {
      return await readFile(this.getAbsolutePreviewPath(reference.previewPath));
    } catch {
      throw new NotFoundException('Forbidden frame preview not found');
    }
  }

  isForbidden(frameHash: string): boolean {
    return this.hashes.has(frameHash);
  }

  async reloadCache(): Promise<void> {
    const references = await this.prisma.forbiddenFrameReference.findMany({
      select: { thumbnailHash: true },
    });
    this.hashes.clear();

    for (const reference of references) {
      this.hashes.add(reference.thumbnailHash);
    }
  }

  private validateFile(file?: ForbiddenFrameUpload): asserts file is ForbiddenFrameUpload {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are supported');
    }

    if (file.size <= 0 || file.size > this.config.maxUploadBytes) {
      throw new BadRequestException(
        `Image must be between 1 byte and ${this.config.maxUploadBytes} bytes`,
      );
    }
  }

  private normalizeLabel(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('Label is required');
    }

    const label = value.trim();

    if (label.length > 120) {
      throw new BadRequestException('Label must not exceed 120 characters');
    }

    return label;
  }

  private async requireReference(id: string) {
    const reference = await this.prisma.forbiddenFrameReference.findUnique({ where: { id } });

    if (!reference) {
      throw new NotFoundException('Forbidden frame reference not found');
    }

    return reference;
  }

  private getAbsolutePreviewPath(previewPath: string): string {
    return join(this.config.directory, basename(previewPath));
  }

  private toDto(reference: {
    id: string;
    label: string;
    thumbnailHash: string;
    createdAt: Date;
    updatedAt: Date;
  }): ForbiddenFrameReferenceDto {
    return {
      id: reference.id,
      label: reference.label,
      thumbnailHash: reference.thumbnailHash,
      previewUrl: `/api/frame-references/${reference.id}/preview`,
      createdAt: reference.createdAt.toISOString(),
      updatedAt: reference.updatedAt.toISOString(),
    };
  }
}
