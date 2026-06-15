import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { CatalogImportService } from './catalog-import.service.js';
import type { ImportApplyRequest, ImportPreviewRequest } from './catalog-import.types.js';

@Controller('catalog/import')
@UseGuards(SessionAuthGuard)
export class CatalogImportController {
  constructor(@Inject(CatalogImportService) private readonly importer: CatalogImportService) {}

  @Get('sources')
  sources() {
    return this.importer.getSources();
  }

  @Post('preview')
  preview(@Body() body: ImportPreviewRequest) {
    return this.importer.preview(body);
  }

  @Post('apply')
  apply(@Body() body: ImportApplyRequest) {
    return this.importer.apply(body);
  }
}
