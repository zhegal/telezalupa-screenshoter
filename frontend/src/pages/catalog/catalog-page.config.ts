import type { EntityConfig } from './catalog-page.types';

export const entityConfigs: EntityConfig[] = [
  {
    entity: 'providers',
    label: 'Providers',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      {
        name: 'urlTemplate',
        label: 'URL template',
        type: 'text',
        placeholder: 'https://host/{streamKey}/playlist.m3u8',
      },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'timezones',
    label: 'Timezones',
    fields: [
      { name: 'timezone', label: 'Timezone', type: 'text', placeholder: 'Europe/Kyiv' },
      { name: 'label', label: 'Label', type: 'text', placeholder: 'Київ' },
      { name: 'priority', label: 'Priority', type: 'number' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'telegram-chats',
    label: 'Telegram',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'chatId', label: 'Chat ID', type: 'text' },
      { name: 'isDefault', label: 'Default', type: 'checkbox' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'caption-templates',
    label: 'Подписи',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'template', label: 'Template', type: 'textarea' },
      { name: 'isDefault', label: 'Default', type: 'checkbox' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
];
