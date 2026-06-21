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
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { CatalogService } from './catalog.service.js';
import type {
  BulkRelationBody,
  BulkStreamsBody,
  CatalogEntity,
  CatalogListQuery,
  CatalogRelationBody,
} from './catalog.types.js';

@Controller('catalog')
@UseGuards(SessionAuthGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Post('streams/bulk-transform-preview')
  bulkTransformPreview(@Body() body: BulkStreamsBody) {
    return this.catalog.bulkTransformPreview(body);
  }

  @Post('streams/bulk-transform-apply')
  bulkTransformApply(@Body() body: BulkStreamsBody) {
    return this.catalog.bulkTransformApply(body);
  }

  @Post('streams/bulk-provider-assign')
  bulkProviderAssign(@Body() body: BulkStreamsBody) {
    return this.catalog.bulkProviderAssign(body);
  }

  @Post('streams/bulk-enable')
  bulkEnableStreams(@Body() body: BulkStreamsBody) {
    return this.catalog.bulkSetStreamsEnabled(body, true);
  }

  @Post('streams/bulk-disable')
  bulkDisableStreams(@Body() body: BulkStreamsBody) {
    return this.catalog.bulkSetStreamsEnabled(body, false);
  }

  @Get(':entity')
  list(@Param('entity') entity: CatalogEntity, @Query() query: CatalogListQuery) {
    return this.catalog.list(entity, query);
  }

  @Get(':entity/:id')
  get(@Param('entity') entity: CatalogEntity, @Param('id') id: string) {
    return this.catalog.get(entity, id);
  }

  @Post(':entity')
  create(@Param('entity') entity: CatalogEntity, @Body() body: Record<string, unknown>) {
    return this.catalog.create(entity, body);
  }

  @Patch(':entity/:id')
  update(
    @Param('entity') entity: CatalogEntity,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.catalog.update(entity, id, body);
  }

  @Delete(':entity/:id')
  @HttpCode(200)
  delete(@Param('entity') entity: CatalogEntity, @Param('id') id: string) {
    return this.catalog.delete(entity, id);
  }
}

@Controller('catalog/playlists/:playlistId/channels')
@UseGuards(SessionAuthGuard)
export class CatalogPlaylistChannelsController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  list(@Param('playlistId') playlistId: string) {
    return this.catalog.listPlaylistChannels(playlistId);
  }

  @Post()
  create(@Param('playlistId') playlistId: string, @Body() body: CatalogRelationBody) {
    return this.catalog.addPlaylistChannel(playlistId, body);
  }

  @Post('bulk-attach')
  bulkAttach(@Param('playlistId') playlistId: string, @Body() body: BulkRelationBody) {
    return this.catalog.bulkAttachPlaylistChannels(playlistId, body);
  }

  @Post('bulk-detach')
  bulkDetach(@Param('playlistId') playlistId: string, @Body() body: BulkRelationBody) {
    return this.catalog.bulkDetachPlaylistChannels(playlistId, body);
  }

  @Post('owned')
  createOwned(@Param('playlistId') playlistId: string, @Body() body: Record<string, unknown>) {
    return this.catalog.createPlaylistOwnedChannel(playlistId, body);
  }

  @Post('bulk-delete-owned')
  bulkDeleteOwned(@Param('playlistId') playlistId: string, @Body() body: BulkRelationBody) {
    return this.catalog.bulkDeletePlaylistOwnedChannels(playlistId, body);
  }

  @Post(':channelId/copy')
  copy(@Param('playlistId') playlistId: string, @Param('channelId') channelId: string, @Body() body: Record<string, unknown>) {
    return this.catalog.copyPlaylistOwnedChannel(playlistId, channelId, body);
  }

  @Post(':channelId/move')
  move(@Param('playlistId') playlistId: string, @Param('channelId') channelId: string, @Body() body: Record<string, unknown>) {
    return this.catalog.movePlaylistOwnedChannel(playlistId, channelId, body);
  }

  @Delete(':channelId/owned')
  @HttpCode(200)
  deleteOwned(@Param('playlistId') playlistId: string, @Param('channelId') channelId: string) {
    return this.catalog.deletePlaylistOwnedChannel(playlistId, channelId);
  }

  @Patch(':relationId')
  update(
    @Param('playlistId') playlistId: string,
    @Param('relationId') relationId: string,
    @Body() body: CatalogRelationBody,
  ) {
    return this.catalog.updatePlaylistChannel(playlistId, relationId, body);
  }

  @Delete(':relationId')
  @HttpCode(200)
  delete(@Param('playlistId') playlistId: string, @Param('relationId') relationId: string) {
    return this.catalog.deletePlaylistChannel(playlistId, relationId);
  }
}

@Controller('catalog/channels/:channelId/streams')
@UseGuards(SessionAuthGuard)
export class CatalogChannelStreamsController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  list(@Param('channelId') channelId: string) {
    return this.catalog.listChannelStreams(channelId);
  }

  @Post()
  create(@Param('channelId') channelId: string, @Body() body: CatalogRelationBody) {
    return this.catalog.addChannelStream(channelId, body);
  }

  @Post('bulk-attach')
  bulkAttach(@Param('channelId') channelId: string, @Body() body: BulkRelationBody) {
    return this.catalog.bulkAttachChannelStreams(channelId, body);
  }

  @Post('bulk-detach')
  bulkDetach(@Param('channelId') channelId: string, @Body() body: BulkRelationBody) {
    return this.catalog.bulkDetachChannelStreams(channelId, body);
  }

  @Post('owned')
  createOwned(@Param('channelId') channelId: string, @Body() body: Record<string, unknown>) {
    return this.catalog.createChannelOwnedStream(channelId, body);
  }

  @Delete(':streamId/owned')
  @HttpCode(200)
  deleteOwned(@Param('channelId') channelId: string, @Param('streamId') streamId: string) {
    return this.catalog.deleteChannelOwnedStream(channelId, streamId);
  }

  @Patch(':relationId')
  update(
    @Param('channelId') channelId: string,
    @Param('relationId') relationId: string,
    @Body() body: CatalogRelationBody,
  ) {
    return this.catalog.updateChannelStream(channelId, relationId, body);
  }

  @Delete(':relationId')
  @HttpCode(200)
  delete(@Param('channelId') channelId: string, @Param('relationId') relationId: string) {
    return this.catalog.deleteChannelStream(channelId, relationId);
  }
}

@Controller('catalog/channels/:channelId/timezones')
@UseGuards(SessionAuthGuard)
export class CatalogChannelTimezonesController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  list(@Param('channelId') channelId: string) {
    return this.catalog.listChannelTimezones(channelId);
  }

  @Post()
  create(@Param('channelId') channelId: string, @Body() body: CatalogRelationBody) {
    return this.catalog.addChannelTimezone(channelId, body);
  }

  @Patch(':relationId')
  update(
    @Param('channelId') channelId: string,
    @Param('relationId') relationId: string,
    @Body() body: CatalogRelationBody,
  ) {
    return this.catalog.updateChannelTimezone(channelId, relationId, body);
  }

  @Delete(':relationId')
  @HttpCode(200)
  delete(@Param('channelId') channelId: string, @Param('relationId') relationId: string) {
    return this.catalog.deleteChannelTimezone(channelId, relationId);
  }
}

@Controller('catalog/playlists/:playlistId/timezones')
@UseGuards(SessionAuthGuard)
export class CatalogPlaylistTimezonesController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  list(@Param('playlistId') playlistId: string) {
    return this.catalog.listPlaylistTimezones(playlistId);
  }

  @Post()
  create(@Param('playlistId') playlistId: string, @Body() body: CatalogRelationBody) {
    return this.catalog.addPlaylistTimezone(playlistId, body);
  }

  @Patch(':relationId')
  update(
    @Param('playlistId') playlistId: string,
    @Param('relationId') relationId: string,
    @Body() body: CatalogRelationBody,
  ) {
    return this.catalog.updatePlaylistTimezone(playlistId, relationId, body);
  }

  @Delete(':relationId')
  @HttpCode(200)
  delete(@Param('playlistId') playlistId: string, @Param('relationId') relationId: string) {
    return this.catalog.deletePlaylistTimezone(playlistId, relationId);
  }
}
