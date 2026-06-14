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
          <span class="nav-icon">
            <AppIcon :name="item.icon" />
          </span>
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
          <span>{{ auth.user?.displayName || auth.user?.username || t.backend }}</span>
          <button class="ghost-button" type="button" @click="handleLogout">{{ t.logout }}</button>
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
import { useAuthStore } from '../stores/auth.store';
import { router } from '../router';
import AppIcon from '../components/icons/AppIcon.vue';
import type { AppIconName } from '../components/icons/icon.types';

const auth = useAuthStore();

const navItems: { to: string; label: string; icon: AppIconName }[] = [
  { to: '/', label: t.dashboard, icon: 'dashboard' },
  { to: '/worker', label: t.sections.worker, icon: 'play' },
  { to: '/telegram', label: t.sections.telegram, icon: 'send' },
  { to: '/playlists', label: t.sections.playlists, icon: 'file-list' },
  { to: '/channels', label: t.sections.channels, icon: 'radio' },
  { to: '/logs', label: t.sections.logs, icon: 'logs' },
  { to: '/settings', label: t.sections.settings, icon: 'settings' },
];

async function handleLogout() {
  await auth.logout();
  await router.push('/login');
}
</script>
