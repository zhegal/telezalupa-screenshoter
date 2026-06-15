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
import { TelegramService } from '../telegram/telegram.service.js';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker.config.js';
import { PlaylistLoaderService } from '../playlists/playlist-loader.service.js';
import { SchedulerService } from './scheduler.service.js';
import { WorkerStateService } from './worker-state.service.js';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import { SourceSettingsService } from '../settings/source-settings.service.js';

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

    if (sourceStatus.activeChannelSource === 'database') {
      const message = 'Database channel source is selected but worker database loader is not implemented yet';
      this.logger.warn(message);
      this.logs.add('warn', 'worker', message);
      this.scheduleNext(this.workerConfig.retryIntervalMs);
      return;
    }

    if (!sourceStatus.json.sourceAvailable) {
      const message = sourceStatus.json.error || 'JSON channel source is not available';
      this.logger.warn(message);
      this.logs.add('warn', 'worker', message, {
        filePath: sourceStatus.json.path,
      });
      this.scheduleNext(this.workerConfig.retryIntervalMs);
      return;
    }

    const selected = await this.playlistSelector.selectChannel();

    if (!selected) {
      this.logger.warn('No available channels now');
      this.logs.add('warn', 'worker', 'No available channels now');
      this.scheduleNext(this.workerConfig.retryIntervalMs);
      return;
    }

    const { channel, playlistUrl, currentLeft, total } = selected;

    this.workerState.markSelected(playlistUrl, channel.title);
    this.workerState.markChannelAttempt(playlistUrl, channel.url);
    this.logger.log(`Target: ${channel.title} (${total - currentLeft}/${total}) from ${playlistUrl}`);
    this.logs.add('info', 'worker', 'Selected channel', {
      playlistUrl,
      channelTitle: channel.title,
      currentLeft,
      total,
    });

    const photoBuffer = await this.capture.captureScreenshot(channel);

    if (!photoBuffer) {
      this.workerState.markError('Screenshot capture failed', playlistUrl, channel.url);
      this.logs.add('error', 'ffmpeg', 'Screenshot capture failed', {
        playlistUrl,
        channelTitle: channel.title,
        channelUrl: channel.url,
      });
      this.scheduleNext(this.workerConfig.errorRetryIntervalMs);
      return;
    }

    const caption = this.captionBuilder.buildCaption(channel);

    const sent = await this.telegram.sendPhoto(photoBuffer, caption);

    if (!sent.ok) {
      this.workerState.markError(sent.errorMessage || 'Telegram send failed', playlistUrl, channel.url);
      this.logs.add('error', 'telegram', 'Telegram send failed', {
        playlistUrl,
        channelTitle: channel.title,
        channelUrl: channel.url,
        error: sent.errorMessage,
      });
      this.scheduleNext(this.workerConfig.errorRetryIntervalMs);
      return;
    }

    this.workerState.markSuccess(playlistUrl, channel.url, channel.title, sent.messageId);
    this.logs.add('info', 'telegram', 'Telegram photo sent', {
      playlistUrl,
      channelTitle: channel.title,
      messageId: sent.messageId,
    });

    this.scheduleNext();
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
