import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { CaptionBuilderService } from '../captions/caption-builder.service.js';
import { FfmpegCaptureService } from '../capture/ffmpeg-capture.service.js';
import { PlaylistSelectorService } from '../playlists/playlist-selector.service.js';
import { DatabasePlaylistSelectorService } from '../playlists/database-playlist-selector.service.js';
import { TelegramService } from '../telegram/telegram.service.js';
import { TelegramPublicationService } from '../telegram/telegram-publication.service.js';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker.config.js';
import { PlaylistLoaderService } from '../playlists/playlist-loader.service.js';
import { SchedulerService } from './scheduler.service.js';
import { WorkerStateService } from './worker-state.service.js';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import { SourceSettingsService } from '../settings/source-settings.service.js';
import { FrameFingerprintService } from '../frames/frame-fingerprint.service.js';
import { FrameStateService } from '../frames/frame-state.service.js';
import { ForbiddenFrameReferenceService } from '../frames/forbidden-frame-reference.service.js';
import type { Channel } from '../channels/channel.types.js';
import type { ChannelSource } from '../settings/source-settings.types.js';
import type { SelectedChannel } from '../playlists/playlist.types.js';

export interface WorkerRunResult {
  status: 'started' | 'stopped' | 'busy' | 'completed' | 'ignored';
  worker: ReturnType<WorkerStateService['getSnapshot']>;
}

export type WorkerChannelOutcome =
  | 'published'
  | 'filtered_duplicate'
  | 'filtered_forbidden'
  | 'capture_failed'
  | 'telegram_failed'
  | 'processing_failed';

@Injectable()
export class WorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    @Inject(WORKER_CONFIG) private readonly workerConfig: WorkerConfig,
    @Inject(PlaylistLoaderService) private readonly playlistLoader: PlaylistLoaderService,
    @Inject(PlaylistSelectorService) private readonly playlistSelector: PlaylistSelectorService,
    @Inject(DatabasePlaylistSelectorService)
    private readonly databasePlaylistSelector: DatabasePlaylistSelectorService,
    @Inject(FfmpegCaptureService) private readonly capture: FfmpegCaptureService,
    @Inject(TelegramService) private readonly telegram: TelegramService,
    @Inject(CaptionBuilderService) private readonly captionBuilder: CaptionBuilderService,
    @Inject(SchedulerService) private readonly scheduler: SchedulerService,
    @Inject(WorkerStateService) private readonly workerState: WorkerStateService,
    @Inject(RuntimeLogService) private readonly logs: RuntimeLogService,
    @Inject(SourceSettingsService) private readonly sourceSettings: SourceSettingsService,
    @Inject(FrameFingerprintService) private readonly frameFingerprint: FrameFingerprintService,
    @Inject(FrameStateService) private readonly frameState: FrameStateService,
    @Inject(ForbiddenFrameReferenceService)
    private readonly forbiddenFrames: ForbiddenFrameReferenceService,
    @Inject(TelegramPublicationService)
    private readonly publications: TelegramPublicationService,
  ) {}

  onApplicationBootstrap(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): WorkerRunResult {
    if (this.workerState.getStatus() === 'running') {
      return { status: 'started', worker: this.getStatus() };
    }

    this.workerState.setStatus('running');
    this.logs.add('info', 'worker', 'Worker started');
    void this.runOnce();

    return { status: 'started', worker: this.getStatus() };
  }

  stop(): WorkerRunResult {
    this.workerState.setStatus('stopped');
    this.scheduler.clear();
    this.logs.add('info', 'worker', 'Worker stopped');

    return { status: 'stopped', worker: this.getStatus() };
  }

  async restart(): Promise<WorkerRunResult> {
    this.stop();
    this.workerState.markRestarted();
    this.workerState.clearRuntimeCaches();
    this.playlistSelector.reset();
    this.databasePlaylistSelector.reset();
    const sourceStatus = await this.refreshSourceStatus();

    if (sourceStatus.activeChannelSource === 'json') {
      await this.playlistLoader.reloadAllPlaylists();
    }

    this.logs.add('info', 'worker', 'Worker restarted');

    return this.start();
  }

  async runOnce(options: { allowStopped?: boolean } = {}): Promise<WorkerRunResult> {
    if (this.workerState.getStatus() !== 'running' && !options.allowStopped) {
      return { status: 'ignored', worker: this.getStatus() };
    }

    if (this.workerState.getCycleRunning()) {
      return { status: 'busy', worker: this.getStatus() };
    }

    this.workerState.setCycleRunning(true);
    this.workerState.markCycleStarted();

    try {
      await this.runCycleStep();
    } finally {
      this.workerState.setCycleRunning(false);
      this.workerState.markCycleFinished();
    }

    return { status: 'completed', worker: this.getStatus() };
  }

  getStatus() {
    return this.workerState.getSnapshot();
  }

  async getFreshStatus() {
    await this.refreshSourceStatus();

    return this.getStatus();
  }

  private async runCycleStep(): Promise<void> {
    const sourceStatus = await this.refreshSourceStatus();

    if (sourceStatus.activeChannelSource === 'json' && !sourceStatus.json.sourceAvailable) {
      const message = sourceStatus.json.error || 'JSON channel source is not available';
      this.logger.warn(message);
      this.logs.add('warn', 'worker', message, {
        filePath: sourceStatus.json.path,
      });
      this.scheduleNext(this.workerConfig.retryIntervalMs);
      return;
    }

    if (sourceStatus.activeChannelSource === 'database') {
      await this.runDatabaseCycleStep();
      return;
    }

    await this.runJsonCycleStep();
  }

  private async runJsonCycleStep(): Promise<void> {
    const attemptedChannels = new Set<string>();
    let duplicateFrames = 0;
    let forbiddenFrames = 0;

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const selected = await this.playlistSelector.selectChannel();

      if (!selected) {
        this.logger.warn('No available channels now');
        this.logs.add('warn', 'worker', 'No available channels now');
        this.scheduleNext(
          attemptedChannels.size > 0
            ? this.workerConfig.intervalMs
            : this.workerConfig.retryIntervalMs,
        );
        return;
      }

      const selectedKey = this.getSelectedChannelKey(selected);

      if (attemptedChannels.has(selectedKey)) {
        this.finishFilteredCycle(attemptedChannels.size, duplicateFrames, forbiddenFrames);
        return;
      }

      attemptedChannels.add(selectedKey);
      const outcome = await this.processSelectedChannel(selected, 'json');

      if (outcome === 'filtered_duplicate' || outcome === 'filtered_forbidden') {
        duplicateFrames += outcome === 'filtered_duplicate' ? 1 : 0;
        forbiddenFrames += outcome === 'filtered_forbidden' ? 1 : 0;
        continue;
      }

      this.scheduleAfterOutcome(outcome);
      return;
    }

    this.finishFilteredCycle(attemptedChannels.size, duplicateFrames, forbiddenFrames);
  }

  private async runDatabaseCycleStep(): Promise<void> {
    const maxAttempts = 100;
    const attemptedChannels = new Set<string>();
    let captureFailures = 0;
    let duplicateFrames = 0;
    let forbiddenFrames = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const selected = await this.databasePlaylistSelector.selectChannel();

      if (!selected) {
        const diagnostics = await this.databasePlaylistSelector.getDiagnostics();
        this.logger.warn(`No available database channels now: ${JSON.stringify(diagnostics)}`);
        this.logs.add('warn', 'worker', 'No available database channels now', diagnostics);
        this.scheduleNext(this.workerConfig.retryIntervalMs);
        return;
      }

      const selectedKey = this.getSelectedChannelKey(selected);

      if (attemptedChannels.has(selectedKey)) {
        this.finishDatabaseAttempts(
          attemptedChannels.size,
          captureFailures,
          duplicateFrames,
          forbiddenFrames,
        );
        return;
      }

      attemptedChannels.add(selectedKey);

      const outcome = await this.processSelectedChannel(selected, 'database');

      if (outcome === 'filtered_duplicate' || outcome === 'filtered_forbidden') {
        duplicateFrames += outcome === 'filtered_duplicate' ? 1 : 0;
        forbiddenFrames += outcome === 'filtered_forbidden' ? 1 : 0;
        continue;
      }

      if (outcome === 'capture_failed') {
        captureFailures += 1;
        continue;
      }

      this.scheduleAfterOutcome(outcome);
      if (outcome !== 'published') {
        return;
      }

      return;
    }

    this.finishDatabaseAttempts(
      attemptedChannels.size,
      captureFailures,
      duplicateFrames,
      forbiddenFrames,
    );
  }

  private async processSelectedChannel(
    selected: SelectedChannel,
    source: ChannelSource,
  ): Promise<WorkerChannelOutcome> {
    const { channel, playlistUrl, currentLeft, total } = selected;

    this.workerState.markSelected(playlistUrl, channel.title);
    this.logger.log(
      `Target: ${channel.title} (${total - currentLeft}/${total}) from ${playlistUrl}`,
    );
    this.logs.add('info', 'worker', 'Selected channel', {
      playlistUrl,
      channelTitle: channel.title,
      currentLeft,
      total,
    });

    const captureResult = await this.captureWithFallback(channel, playlistUrl, source);

    if (!captureResult) {
      this.workerState.markError('Screenshot capture failed', playlistUrl, channel.url);
      this.logs.add('error', 'ffmpeg', 'Screenshot capture failed', {
        playlistUrl,
        channelTitle: channel.title,
        channelUrl: channel.url,
      });

      return 'capture_failed';
    }

    const { channel: capturedChannel, photoBuffer } = captureResult;
    const channelKey = this.getSelectedChannelKey(selected);
    let frameHash: string;

    try {
      frameHash = await this.frameFingerprint.createHash(photoBuffer);

      if (this.forbiddenFrames.isForbidden(frameHash)) {
        this.logger.log(`Skipped forbidden frame: ${channel.title}`);
        this.logs.add('info', 'worker', 'Skipped forbidden frame', {
          channelKey,
          playlistUrl,
          channelTitle: channel.title,
        });
        return 'filtered_forbidden';
      }

      if (await this.frameState.isConsecutiveDuplicate(channelKey, frameHash)) {
        this.logger.log(`Skipped consecutive duplicate: ${channel.title}`);
        this.logs.add('info', 'worker', 'Skipped consecutive duplicate frame', {
          channelKey,
          playlistUrl,
          channelTitle: channel.title,
        });
        return 'filtered_duplicate';
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.workerState.markError(
        `Frame fingerprint failed: ${error}`,
        playlistUrl,
        capturedChannel.url,
      );
      this.logs.add('error', 'worker', 'Frame fingerprint failed', {
        channelKey,
        playlistUrl,
        channelTitle: channel.title,
        error,
      });
      return 'processing_failed';
    }

    const caption = this.captionBuilder.buildCaption(channel);

    const sent = await this.telegram.sendPhoto(photoBuffer, caption);

    if (!sent.ok) {
      this.workerState.markError(
        sent.errorMessage || 'Telegram send failed',
        playlistUrl,
        channel.url,
      );
      this.logs.add('error', 'telegram', 'Telegram send failed', {
        playlistUrl,
        channelTitle: channel.title,
        channelUrl: capturedChannel.url,
        error: sent.errorMessage,
      });
      return 'telegram_failed';
    }

    this.workerState.markSuccess(playlistUrl, capturedChannel.url, channel.title, sent.messageId);
    this.logs.add('info', 'telegram', 'Telegram photo sent', {
      playlistUrl,
      channelTitle: channel.title,
      messageId: sent.messageId,
    });

    if (sent.chatId && sent.messageId !== undefined) {
      try {
        await this.publications.record({
          channelKey,
          channelId: channel.databaseId,
          channelTitle: channel.title,
          chatId: sent.chatId,
          messageId: sent.messageId,
          frameHash,
          publishedAt: sent.publishedAt,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.workerState.markError(
          `Telegram publication save failed: ${error}`,
          playlistUrl,
          capturedChannel.url,
        );
        this.logs.add('error', 'telegram', 'Telegram publication save failed', {
          channelKey,
          channelTitle: channel.title,
          messageId: sent.messageId,
          error,
        });
      }
    } else {
      this.logs.add(
        'error',
        'telegram',
        'Telegram response did not include publication identifiers',
        {
          channelKey,
          channelTitle: channel.title,
        },
      );
    }

    return 'published';
  }

  private getSelectedChannelKey(selected: SelectedChannel): string {
    return (
      selected.channel.sourceKey ||
      `${selected.playlistUrl}\n${selected.channel.title}\n${selected.channel.url}`
    );
  }

  private scheduleAfterOutcome(outcome: WorkerChannelOutcome): void {
    this.scheduleNext(
      outcome === 'published'
        ? this.workerConfig.intervalMs
        : this.workerConfig.errorRetryIntervalMs,
    );
  }

  private finishFilteredCycle(
    attemptedChannels: number,
    duplicateFrames: number,
    forbiddenFrames: number,
  ): void {
    this.logger.log(`All ${attemptedChannels} attempted channels were filtered`);
    this.logs.add('info', 'worker', 'All attempted channels were filtered', {
      attemptedChannels,
      duplicateFrames,
      forbiddenFrames,
    });
    this.scheduleNext(this.workerConfig.intervalMs);
  }

  private finishDatabaseAttempts(
    attemptedChannels: number,
    captureFailures: number,
    duplicateFrames: number,
    forbiddenFrames: number,
  ): void {
    const onlyFiltered = captureFailures === 0;
    const message = onlyFiltered
      ? 'All attempted database channels were filtered'
      : 'Database channel attempts exhausted';

    if (onlyFiltered) {
      this.logger.log(message);
      this.logs.add('info', 'worker', message, {
        attemptedChannels,
        duplicateFrames,
        forbiddenFrames,
      });
    } else {
      this.logger.warn(message);
      this.logs.add('warn', 'worker', message, { attemptedChannels, captureFailures });
    }

    this.scheduleNext(
      onlyFiltered ? this.workerConfig.intervalMs : this.workerConfig.errorRetryIntervalMs,
    );
  }

  private async captureWithFallback(
    channel: Channel,
    playlistUrl: string,
    source: ChannelSource,
  ): Promise<{ channel: Channel; photoBuffer: Buffer } | null> {
    const streamCandidates =
      source === 'database' && channel.streamCandidates?.length
        ? channel.streamCandidates
        : [
            {
              id: 'default',
              title: channel.title,
              url: channel.url,
              userAgent: channel['user-agent'],
            },
          ];

    for (const stream of streamCandidates) {
      const streamChannel: Channel = {
        ...channel,
        url: stream.url,
        'user-agent': stream.userAgent,
      };

      this.workerState.markChannelAttempt(playlistUrl, streamChannel.url);
      this.logs.add('info', 'worker', 'Trying stream', {
        playlistUrl,
        channelTitle: channel.title,
        streamTitle: stream.title,
        streamUrl: stream.url,
      });

      const photoBuffer = await this.capture.captureScreenshot(streamChannel);

      if (photoBuffer) {
        return { channel: streamChannel, photoBuffer };
      }

      this.workerState.markError('Screenshot capture failed', playlistUrl, streamChannel.url);
      this.logs.add('error', 'ffmpeg', 'Screenshot capture failed', {
        playlistUrl,
        channelTitle: channel.title,
        channelUrl: streamChannel.url,
        streamTitle: stream.title,
      });
    }

    return null;
  }

  private scheduleNext(delayMs = this.workerConfig.intervalMs): void {
    if (this.workerState.getStatus() !== 'running') {
      this.workerState.setNextRun(null);
      return;
    }

    this.workerState.setNextRun(delayMs);
    this.scheduler.schedule(() => {
      void this.runOnce();
    }, delayMs);
  }

  private async refreshSourceStatus() {
    const sourceStatus = await this.sourceSettings.getStatus();
    this.workerState.setSourceStatus(sourceStatus);

    return sourceStatus;
  }
}
