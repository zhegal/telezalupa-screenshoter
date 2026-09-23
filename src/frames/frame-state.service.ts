import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PublishedFrameState {
  channelKey: string;
  channelId?: string;
  frameHash: string;
  publishedAt?: Date;
}

@Injectable()
export class FrameStateService {
  private readonly lastPublishedHashes = new Map<string, string | null>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async isConsecutiveDuplicate(channelKey: string, frameHash: string): Promise<boolean> {
    if (!this.lastPublishedHashes.has(channelKey)) {
      const state = await this.prisma.channelFrameState.findUnique({
        where: { channelKey },
        select: { lastPublishedHash: true },
      });

      this.lastPublishedHashes.set(channelKey, state?.lastPublishedHash ?? null);
    }

    return this.lastPublishedHashes.get(channelKey) === frameHash;
  }

  async recordPublished(state: PublishedFrameState): Promise<void> {
    const publishedAt = state.publishedAt ?? new Date();
    this.rememberPublished(state.channelKey, state.frameHash);

    await this.prisma.channelFrameState.upsert({
      where: { channelKey: state.channelKey },
      create: {
        channelKey: state.channelKey,
        channelId: state.channelId,
        lastPublishedHash: state.frameHash,
        lastPublishedAt: publishedAt,
      },
      update: {
        channelId: state.channelId,
        lastPublishedHash: state.frameHash,
        lastPublishedAt: publishedAt,
      },
    });
  }

  rememberPublished(channelKey: string, frameHash: string): void {
    this.lastPublishedHashes.set(channelKey, frameHash);
  }
}
