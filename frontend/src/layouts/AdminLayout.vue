<template>
  <div class="admin-shell app-dark">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">TV</span>
        <span>
          <strong>{{ t.appTitle }}</strong>
          <small>{{ t.dashboard }}</small>
        </span>
      </RouterLink>

      <nav class="nav-list" aria-label="Основная навигация">
        <RouterLink v-for="item in navItems" :key="item.to" class="nav-item" :to="item.to">
          <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="content-shell">
      <header class="topbar">
        <div>
          <p>{{ t.appSubtitle }}</p>
          <h1>{{ t.dashboard }}</h1>
        </div>
        <div class="topbar-status">
          <span class="status-dot" />
          <span>{{ t.backend }}</span>
        </div>
      </header>

      <main class="page-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../services/i18n';

const navItems = [
  { to: '/', label: t.dashboard, icon: '⌂' },
  { to: '/worker', label: t.sections.worker, icon: '▶' },
  { to: '/telegram', label: t.sections.telegram, icon: '✉' },
  { to: '/playlists', label: t.sections.playlists, icon: '≡' },
  { to: '/channels', label: t.sections.channels, icon: '◉' },
  { to: '/settings', label: t.sections.settings, icon: '⚙' },
];
</script>
