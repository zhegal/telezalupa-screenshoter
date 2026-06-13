export const messages = {
  ru: {
    appTitle: 'TV Screenshoter',
    appSubtitle: 'Приватная панель управления скриншотером',
    dashboard: 'Панель управления',
    backend: 'Backend',
    status: 'Статус',
    online: 'Онлайн',
    offline: 'Недоступен',
    checking: 'Проверка...',
    healthEndpoint: 'GET /api/health',
    lastCheck: 'Последняя проверка',
    refresh: 'Обновить',
    futureSections: 'Будущие разделы',
    mobileHint: 'Черновик админки готов к расширению API, авторизации и CRUD.',
    sections: {
      worker: 'Worker',
      telegram: 'Telegram',
      playlists: 'Playlists',
      channels: 'Channels',
      settings: 'Settings',
    },
    sectionDescriptions: {
      worker: 'Старт, стоп, рестарт и состояние фонового цикла.',
      telegram: 'Чаты, отправки, message id, реакции и статистика.',
      playlists: 'Источники плейлистов, загрузка и будущая синхронизация.',
      channels: 'Каналы, доступность, timezone, delay и user-agent.',
      settings: 'Runtime-конфиги, ffmpeg, интервалы и системные параметры.',
    },
  },
};

export const t = messages.ru;
