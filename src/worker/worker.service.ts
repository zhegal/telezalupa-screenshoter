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

@Injectable()
export class WorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    @Inject(WORKER_CONFIG) private readonly workerConfig: WorkerConfig,
    private readonly playlistLoader: PlaylistLoaderService,
    private readonly playlistSelector: PlaylistSelectorService,
    private readonly capture: FfmpegCaptureService,
    private readonly telegram: TelegramService,
    private readonly captionBuilder: CaptionBuilderService,
    private readonly scheduler: SchedulerService,
    private readonly workerState: WorkerStateService,
  ) {}

  onApplicationBootstrap(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    if (this.workerState.getStatus() === 'running') {
      return;
    }

    this.workerState.setStatus('running');
    void this.runOnce();
  }

  stop(): void {
    this.workerState.setStatus('stopped');
    this.scheduler.clear();
  }

  async restart(): Promise<void> {
    this.stop();
    this.playlistSelector.reset();
    await this.playlistLoader.reloadAllPlaylists();
    this.start();
  }

  async runOnce(): Promise<void> {
    if (this.workerState.getStatus() !== 'running') {
      return;
    }

    if (this.workerState.getCycleRunning()) {
      return;
    }

    this.workerState.setCycleRunning(true);

    try {
      await this.runCycleStep();
    } finally {
      this.workerState.setCycleRunning(false);
    }
  }

  private async runCycleStep(): Promise<void> {
    const selected = await this.playlistSelector.selectChannel();

    if (!selected) {
      this.logger.warn('No available channels now');
      this.scheduleNext(this.workerConfig.retryIntervalMs);
      return;
    }

    const { channel, playlistUrl, currentLeft, total } = selected;

    this.logger.log(`Target: ${channel.title} (${total - currentLeft}/${total}) from ${playlistUrl}`);

    const photoBuffer = await this.capture.captureScreenshot(channel);

    if (!photoBuffer) {
      this.scheduleNext(this.workerConfig.errorRetryIntervalMs);
      return;
    }

    const caption = this.captionBuilder.buildCaption(channel);

    await this.telegram.sendPhoto(photoBuffer, caption);

    this.scheduleNext();
  }

  private scheduleNext(delayMs = this.workerConfig.intervalMs): void {
    if (this.workerState.getStatus() !== 'running') {
      return;
    }

    this.scheduler.schedule(() => {
      void this.runOnce();
    }, delayMs);
  }
}
