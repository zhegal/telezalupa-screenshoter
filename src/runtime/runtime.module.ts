import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { WorkerModule } from '../worker/worker.module.js';
import { RuntimeController } from './runtime.controller.js';

@Module({
  imports: [AuthModule, PlaylistsModule, WorkerModule],
  controllers: [RuntimeController],
})
export class RuntimeModule {}
