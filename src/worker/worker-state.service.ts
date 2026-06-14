import { Injectable } from '@nestjs/common';

export type WorkerStatus = 'stopped' | 'running';

export interface WorkerStatusSnapshot {
  running: boolean;
  busy: boolean;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastRestartedAt: string | null;
  lastCycleStartedAt: string | null;
  lastCycleFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  nextRunAt: string | null;
  currentPlaylistUrl: string | null;
  currentChannelTitle: string | null;
  lastPlaylistUrl: string | null;
  lastChannelTitle: string | null;
  lastTelegramSentAt: string | null;
  lastTelegramMessageId: number | null;
  cyclesCount: number;
  successCount: number;
  errorCount: number;
  source: 'json';
}

export interface ChannelRuntimeStatus {
  playlistUrl: string;
  channelUrl: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
}

@Injectable()
export class WorkerStateService {
  private status: WorkerStatus = 'stopped';
  private isCycleRunning = false;
  private readonly channelStatuses = new Map<string, ChannelRuntimeStatus>();
  private lastStartedAt: string | null = null;
  private lastStoppedAt: string | null = null;
  private lastRestartedAt: string | null = null;
  private lastCycleStartedAt: string | null = null;
  private lastCycleFinishedAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastErrorMessage: string | null = null;
  private nextRunAt: string | null = null;
  private currentPlaylistUrl: string | null = null;
  private currentChannelTitle: string | null = null;
  private lastPlaylistUrl: string | null = null;
  private lastChannelTitle: string | null = null;
  private lastTelegramSentAt: string | null = null;
  private lastTelegramMessageId: number | null = null;
  private cyclesCount = 0;
  private successCount = 0;
  private errorCount = 0;

  getStatus(): WorkerStatus {
    return this.status;
  }

  setStatus(status: WorkerStatus): void {
    this.status = status;

    if (status === 'running') {
      this.lastStartedAt = new Date().toISOString();
    } else {
      this.lastStoppedAt = new Date().toISOString();
      this.nextRunAt = null;
    }
  }

  getCycleRunning(): boolean {
    return this.isCycleRunning;
  }

  setCycleRunning(isCycleRunning: boolean): void {
    this.isCycleRunning = isCycleRunning;
  }

  markRestarted(): void {
    this.lastRestartedAt = new Date().toISOString();
  }

  markCycleStarted(): void {
    this.lastCycleStartedAt = new Date().toISOString();
    this.lastCycleFinishedAt = null;
    this.cyclesCount += 1;
  }

  markCycleFinished(): void {
    this.lastCycleFinishedAt = new Date().toISOString();
    this.currentPlaylistUrl = null;
    this.currentChannelTitle = null;
  }

  markSelected(playlistUrl: string, channelTitle: string): void {
    this.currentPlaylistUrl = playlistUrl;
    this.currentChannelTitle = channelTitle;
    this.lastPlaylistUrl = playlistUrl;
    this.lastChannelTitle = channelTitle;
  }

  markSuccess(playlistUrl: string, channelUrl: string, channelTitle: string, messageId?: number): void {
    const now = new Date().toISOString();

    this.lastSuccessAt = now;
    this.lastTelegramSentAt = now;
    this.lastTelegramMessageId = messageId ?? null;
    this.lastPlaylistUrl = playlistUrl;
    this.lastChannelTitle = channelTitle;
    this.successCount += 1;
    this.getChannelStatus(playlistUrl, channelUrl).lastSuccessAt = now;
    this.getChannelStatus(playlistUrl, channelUrl).lastErrorAt = null;
    this.getChannelStatus(playlistUrl, channelUrl).lastErrorMessage = null;
    this.getChannelStatus(playlistUrl, channelUrl).consecutiveFailures = 0;
  }

  markError(message: string, playlistUrl?: string, channelUrl?: string): void {
    const now = new Date().toISOString();

    this.lastErrorAt = now;
    this.lastErrorMessage = message;
    this.errorCount += 1;

    if (playlistUrl && channelUrl) {
      const channelStatus = this.getChannelStatus(playlistUrl, channelUrl);
      channelStatus.lastErrorAt = now;
      channelStatus.lastErrorMessage = message;
      channelStatus.consecutiveFailures += 1;
    }
  }

  markChannelAttempt(playlistUrl: string, channelUrl: string): void {
    this.getChannelStatus(playlistUrl, channelUrl).lastAttemptAt = new Date().toISOString();
  }

  setNextRun(delayMs: number | null): void {
    this.nextRunAt = delayMs === null ? null : new Date(Date.now() + delayMs).toISOString();
  }

  getChannelStatus(playlistUrl: string, channelUrl: string): ChannelRuntimeStatus {
    const key = this.getChannelKey(playlistUrl, channelUrl);

    if (!this.channelStatuses.has(key)) {
      this.channelStatuses.set(key, {
        playlistUrl,
        channelUrl,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        consecutiveFailures: 0,
      });
    }

    return this.channelStatuses.get(key) as ChannelRuntimeStatus;
  }

  clearRuntimeCaches(): void {
    this.channelStatuses.clear();
    this.currentPlaylistUrl = null;
    this.currentChannelTitle = null;
    this.nextRunAt = null;
  }

  getSnapshot(): WorkerStatusSnapshot {
    return {
      running: this.status === 'running',
      busy: this.isCycleRunning,
      lastStartedAt: this.lastStartedAt,
      lastStoppedAt: this.lastStoppedAt,
      lastRestartedAt: this.lastRestartedAt,
      lastCycleStartedAt: this.lastCycleStartedAt,
      lastCycleFinishedAt: this.lastCycleFinishedAt,
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastErrorMessage: this.lastErrorMessage,
      nextRunAt: this.nextRunAt,
      currentPlaylistUrl: this.currentPlaylistUrl,
      currentChannelTitle: this.currentChannelTitle,
      lastPlaylistUrl: this.lastPlaylistUrl,
      lastChannelTitle: this.lastChannelTitle,
      lastTelegramSentAt: this.lastTelegramSentAt,
      lastTelegramMessageId: this.lastTelegramMessageId,
      cyclesCount: this.cyclesCount,
      successCount: this.successCount,
      errorCount: this.errorCount,
      source: 'json',
    };
  }

  private getChannelKey(playlistUrl: string, channelUrl: string): string {
    return `${playlistUrl}\n${channelUrl}`;
  }
}
