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
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker.config.js';
import { PlaylistLoaderService } from '../playlists/playlist-loader.service.js';
import { SchedulerService } from './scheduler.service.js';
import { WorkerStateService } from './worker-state.service.js';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import { SourceSettingsService } from '../settings/source-settings.service.js';
import type { Channel } from '../channels/channel.types.js';
import type { ChannelSource } from '../settings/source-settings.types.js';
import type { SelectedChannel } from '../playlists/playlist.types.js';

export interface WorkerRunResult {
  status: 'started' | 'stopped' | 'busy' | 'completed' | 'ignored';
  worker: ReturnType<WorkerStateService['getSnapshot']>;
}

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

    const selected = await this.playlistSelector.selectChannel();

    if (!selected) {
      this.logger.warn('No available channels now');
      this.logs.add('warn', 'worker', 'No available channels now');
      this.scheduleNext(this.workerConfig.retryIntervalMs);
      return;
    }

    await this.processSelectedChannel(selected, sourceStatus.activeChannelSource);
  }

  private async runDatabaseCycleStep(): Promise<void> {
    const maxAttempts = 100;
    const attemptedChannels = new Set<string>();

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const selected = await this.databasePlaylistSelector.selectChannel();

      if (!selected) {
        const diagnostics = await this.databasePlaylistSelector.getDiagnostics();
        this.logger.warn(`No available database channels now: ${JSON.stringify(diagnostics)}`);
        this.logs.add('warn', 'worker', 'No available database channels now', diagnostics);
        this.scheduleNext(this.workerConfig.retryIntervalMs);
        return;
      }

      const selectedKey = `${selected.playlistUrl}\n${selected.channel.title}\n${selected.channel.url}`;

      if (attemptedChannels.has(selectedKey)) {
        this.logger.warn('Database channel attempts exhausted');
        this.logs.add('warn', 'worker', 'Database channel attempts exhausted');
        this.scheduleNext(this.workerConfig.errorRetryIntervalMs);
        return;
      }

      attemptedChannels.add(selectedKey);

      const success = await this.processSelectedChannel(selected, 'database', { scheduleOnCaptureFailure: false });

      if (success) {
        return;
      }
    }

    this.logger.warn('Database channel attempts exhausted');
    this.logs.add('warn', 'worker', 'Database channel attempts exhausted');
    this.scheduleNext(this.workerConfig.errorRetryIntervalMs);
  }

  private async processSelectedChannel(
    selected: SelectedChannel,
    source: ChannelSource,
    options: { scheduleOnCaptureFailure?: boolean } = {},
  ): Promise<boolean> {
    const { channel, playlistUrl, currentLeft, total } = selected;

    this.workerState.markSelected(playlistUrl, channel.title);
    this.logger.log(`Target: ${channel.title} (${total - currentLeft}/${total}) from ${playlistUrl}`);
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

      if (options.scheduleOnCaptureFailure !== false) {
        this.scheduleNext(this.workerConfig.errorRetryIntervalMs);
      }

      return false;
    }

    const { channel: capturedChannel, photoBuffer } = captureResult;
    const caption = this.captionBuilder.buildCaption(channel);

    const sent = await this.telegram.sendPhoto(photoBuffer, caption);

    if (!sent.ok) {
      this.workerState.markError(sent.errorMessage || 'Telegram send failed', playlistUrl, channel.url);
      this.logs.add('error', 'telegram', 'Telegram send failed', {
        playlistUrl,
        channelTitle: channel.title,
        channelUrl: capturedChannel.url,
        error: sent.errorMessage,
      });
      this.scheduleNext(this.workerConfig.errorRetryIntervalMs);
      return true;
    }

    this.workerState.markSuccess(playlistUrl, capturedChannel.url, channel.title, sent.messageId);
    this.logs.add('info', 'telegram', 'Telegram photo sent', {
      playlistUrl,
      channelTitle: channel.title,
      messageId: sent.messageId,
    });

    this.scheduleNext();
    return true;
  }

  private async captureWithFallback(
    channel: Channel,
    playlistUrl: string,
    source: ChannelSource,
  ): Promise<{ channel: Channel; photoBuffer: Buffer } | null> {
    const streamCandidates =
      source === 'database' && channel.streamCandidates?.length
        ? channel.streamCandidates
        : [{ id: 'default', title: channel.title, url: channel.url, userAgent: channel['user-agent'] }];

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
