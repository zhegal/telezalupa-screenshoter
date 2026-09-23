import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { ForbiddenFrameReferenceService } from './forbidden-frame-reference.service.js';
import type { ForbiddenFrameUpload } from './forbidden-frame-reference.types.js';

@Controller('frame-references')
@UseGuards(SessionAuthGuard)
export class ForbiddenFrameReferenceController {
  constructor(
    @Inject(ForbiddenFrameReferenceService)
    private readonly references: ForbiddenFrameReferenceService,
  ) {}

  @Get()
  list() {
    return this.references.list();
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  create(@Body('label') label: string, @UploadedFile() file?: ForbiddenFrameUpload) {
    return this.references.create(label, file);
  }

  @Patch(':id')
  updateLabel(@Param('id') id: string, @Body('label') label: string) {
    return this.references.updateLabel(id, label);
  }

  @Delete(':id')
  @HttpCode(200)
  delete(@Param('id') id: string) {
    return this.references.delete(id);
  }

  @Get(':id/preview')
  async preview(@Param('id') id: string) {
    return new StreamableFile(await this.references.getPreview(id), {
      type: 'image/webp',
      disposition: 'inline',
    });
  }
}
