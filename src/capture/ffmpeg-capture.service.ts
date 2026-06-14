import { Inject, Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import { FFMPEG_CONFIG, type FfmpegConfig } from '../config/ffmpeg.config.js';
import { PLAYLIST_CONFIG, type PlaylistConfig } from '../config/playlist.config.js';
import type { Channel } from '../channels/channel.types.js';
import { RuntimeLogService } from '../logs/runtime-log.service.js';

@Injectable()
export class FfmpegCaptureService {
  private readonly logger = new Logger(FfmpegCaptureService.name);

  constructor(
    @Inject(FFMPEG_CONFIG) private readonly ffmpegConfig: FfmpegConfig,
    @Inject(PLAYLIST_CONFIG) private readonly playlistConfig: PlaylistConfig,
    @Inject(RuntimeLogService) private readonly logs: RuntimeLogService,
  ) {}

  async captureScreenshot(channel: Channel): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let isFinished = false;

      const inputOptions = [
        '-loglevel',
        'error',
        '-rw_timeout',
        String(this.ffmpegConfig.rwTimeoutUs),
      ];

      if (channel['user-agent']) {
        inputOptions.unshift(channel['user-agent']);
        inputOptions.unshift('-user_agent');
      }

      const scale = channel.scale || this.playlistConfig.defaultScale;

      const command = ffmpeg()
        .input(channel.url)
        .inputOptions(inputOptions)
        .outputOptions([
          '-an',
          '-sn',
          '-dn',
          '-fflags',
          '+discardcorrupt',
          '-err_detect',
          'ignore_err',
          '-vf',
          `fps=1/${this.ffmpegConfig.frameDelaySeconds},scale=${scale}`,
          '-frames:v',
          '1',
          '-q:v',
          '2',
          '-f',
          'image2',
          '-vcodec',
          'mjpeg',
        ]);

      const finish = (reason: 'timeout' | 'ffmpeg_error' | 'stream_error', errMsg?: string) => {
        if (isFinished) {
          return;
        }

        isFinished = true;
        clearTimeout(watchdog);

        if (reason === 'timeout') {
          this.logger.error(`Killing stalled process for: ${channel.title}`);
          this.logs.add('error', 'ffmpeg', 'Killing stalled ffmpeg process', {
            channelTitle: channel.title,
            channelUrl: channel.url,
          });
          try {
            command.kill('SIGKILL');
          } catch {}
        } else if (reason === 'ffmpeg_error') {
          this.logger.error(`${channel.title}: ${errMsg || 'ffmpeg error'}`);
          this.logs.add('error', 'ffmpeg', errMsg || 'ffmpeg error', {
            channelTitle: channel.title,
            channelUrl: channel.url,
          });
        } else if (reason === 'stream_error') {
          this.logger.error(`${channel.title}: ${errMsg || 'stream error'}`);
          this.logs.add('error', 'ffmpeg', errMsg || 'stream error', {
            channelTitle: channel.title,
            channelUrl: channel.url,
          });
          try {
            command.kill('SIGKILL');
          } catch {}
        }

        resolve(null);
      };

      const watchdog = setTimeout(() => {
        finish('timeout');
      }, this.ffmpegConfig.watchdogMs);

      command.on('error', (err) => {
        finish('ffmpeg_error', err && err.message ? err.message : String(err));
      });

      const stream = command.pipe();

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));

      stream.on('error', (err) => {
        finish('stream_error', err && err.message ? err.message : String(err));
      });

      stream.on('end', () => {
        if (isFinished) {
          return;
        }

        isFinished = true;
        clearTimeout(watchdog);

        if (chunks.length === 0) {
          this.logger.log(`No data from ${channel.title}`);
          this.logs.add('warn', 'ffmpeg', 'No data from stream', {
            channelTitle: channel.title,
            channelUrl: channel.url,
          });
          resolve(null);
          return;
        }

        resolve(Buffer.concat(chunks));
      });
    });
  }
}
