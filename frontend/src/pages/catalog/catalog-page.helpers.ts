import type { CatalogEntity, CatalogItem } from '../../services/api';
import type { FieldConfig, FormGroup } from './catalog-page.types';

export function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.chatId || item.id);
}

export function detailText(item: CatalogItem) {
  if ('urlTemplate' in item) return String(item.urlTemplate || '');
  if ('directUrl' in item) return String(item.directUrl || item.streamKey || '');
  if ('description' in item) return String(item.description || '');
  if ('timezone' in item) return `${item.timezone || ''} ${item.label || ''}`;
  if ('chatId' in item) return String(item.chatId || '');
  if ('template' in item) return String(item.template || '').slice(0, 120);
  return `priority: ${item.priority ?? 0}`;
}

export function relationSummaryParts(entity: CatalogEntity, item: CatalogItem | null) {
  const count = item?._count as Record<string, number> | undefined;
  if (!count) return [];

  if (entity === 'channels') return [`Streams: ${count.channelStreams ?? 0}`, `Playlists: ${count.playlistChannels ?? 0}`];
  if (entity === 'playlists') return [`Channels: ${count.playlistChannels ?? 0}`];
  if (entity === 'streams') return [`Channels: ${count.channelStreams ?? 0}`];
  if (entity === 'providers') return [`Streams: ${count.streams ?? 0}`];
  return [];
}

export function timezoneSummaryParts(entity: CatalogEntity, item: CatalogItem | null) {
  const count = item?._count as Record<string, number> | undefined;
  if (!count) return [];

  if (entity === 'channels') return [`Timezones: ${count.channelTimezones ?? 0}`];
  if (entity === 'playlists') return [`Timezones: ${count.playlistTimezones ?? 0}`];
  if (entity === 'timezones') return [`Channels: ${count.channelTimezones ?? 0}`, `Playlists: ${count.playlistTimezones ?? 0}`];
  return [];
}

export function summaryText(entity: CatalogEntity, item: CatalogItem) {
  return relationSummaryParts(entity, item).concat(timezoneSummaryParts(entity, item)).join(' · ') || '—';
}

export function tabLabel(entity: CatalogEntity, tab: 'basic' | 'relations' | 'timezones') {
  if (tab === 'basic') return 'Основное';
  if (entity === 'channels' && tab === 'relations') return 'Потоки';
  if (entity === 'playlists' && tab === 'relations') return 'Каналы';
  return 'Таймзоны';
}

export function groupFields(entity: CatalogEntity, fields: FieldConfig[]): FormGroup[] {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const createGroup = (title: string, names: string[], description = '') => ({
    title,
    description,
    fields: names.map((name) => byName.get(name)).filter((field): field is FieldConfig => Boolean(field)),
  });

  if (entity === 'providers') {
    return [
      createGroup('Основное', ['title', 'urlTemplate'], 'URL Template используется worker для формирования рабочего URL потока через {streamKey}.'),
      createGroup('Статус', ['enabled']),
    ];
  }

  if (entity === 'timezones') {
    return [createGroup('Основное', ['timezone', 'label', 'priority']), createGroup('Статус', ['enabled'])];
  }

  if (entity === 'telegram-chats') {
    return [createGroup('Основное', ['title', 'chatId']), createGroup('Статус', ['isDefault', 'enabled'])];
  }

  return [createGroup('Основное', ['title', 'template']), createGroup('Статус', ['isDefault', 'enabled'])];
}

export function checkboxLabel(name: string) {
  return name === 'isDefault' ? 'По умолчанию' : 'Активен';
}
