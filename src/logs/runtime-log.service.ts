import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RuntimeLogEntry, RuntimeLogLevel, RuntimeLogScope } from './logs.types.js';

const MAX_LOGS = 1000;
const RETENTION_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class RuntimeLogService {
  private readonly entries: RuntimeLogEntry[] = [];

  add(
    level: RuntimeLogLevel,
    scope: RuntimeLogScope,
    message: string,
    context?: Record<string, unknown>,
  ): RuntimeLogEntry {
    this.prune();

    const entry: RuntimeLogEntry = {
      id: randomUUID(),
      level,
      scope,
      message,
      context,
      createdAt: new Date().toISOString(),
    };

    this.entries.push(entry);

    if (this.entries.length > MAX_LOGS) {
      this.entries.splice(0, this.entries.length - MAX_LOGS);
    }

    return entry;
  }

  recent(scope?: RuntimeLogScope, limit = 200, offset = 0): { items: RuntimeLogEntry[]; total: number; limit: number; offset: number } {
    this.prune();

    const filtered = scope ? this.entries.filter((entry) => entry.scope === scope) : this.entries;
    const items = filtered.slice().reverse();

    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  private prune(): void {
    const minTime = Date.now() - RETENTION_MS;
    const firstValidIndex = this.entries.findIndex(
      (entry) => new Date(entry.createdAt).getTime() >= minTime,
    );

    if (firstValidIndex > 0) {
      this.entries.splice(0, firstValidIndex);
    } else if (firstValidIndex === -1 && this.entries.length > 0) {
      this.entries.length = 0;
    }
  }
}
