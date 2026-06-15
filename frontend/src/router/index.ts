import { createRouter, createWebHistory } from 'vue-router';
import CatalogPage from '../pages/catalog/CatalogPage.vue';
import CatalogImportPage from '../pages/catalog/CatalogImportPage.vue';
import CatalogRelationManagePage from '../pages/catalog/CatalogRelationManagePage.vue';
import ChannelsPage from '../pages/ChannelsPage.vue';
import DashboardPage from '../pages/DashboardPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import LogsPage from '../pages/LogsPage.vue';
import NotFoundPage from '../pages/NotFoundPage.vue';
import PlaylistsPage from '../pages/PlaylistsPage.vue';
import SetupPage from '../pages/SetupPage.vue';
import SettingsSourcesPage from '../pages/SettingsSourcesPage.vue';
import WorkerPage from '../pages/WorkerPage.vue';
import { useAuthStore } from '../stores/auth.store';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: {
        guestOnly: true,
      },
    },
    {
      path: '/setup',
      name: 'setup',
      component: SetupPage,
      meta: {
        setupOnly: true,
      },
    },
    {
      path: '/worker',
      name: 'worker',
      component: WorkerPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/telegram',
      name: 'telegram',
      component: DashboardPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/playlists',
      name: 'playlists',
      component: PlaylistsPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/channels',
      name: 'channels',
      component: ChannelsPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/logs',
      name: 'logs',
      component: LogsPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/catalog',
      name: 'catalog',
      component: CatalogPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/catalog/import',
      name: 'catalog-import',
      component: CatalogImportPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/catalog/:owner(channels|playlists)/:id/:relation(channels|streams|timezones)',
      name: 'catalog-relations-manage',
      component: CatalogRelationManagePage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsSourcesPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundPage,
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  await auth.initialize();

  if (to.meta.setupOnly) {
    if (!auth.bootstrapStatus?.bootstrapAvailable || !auth.isBootstrap) {
      return { name: 'not-found' };
    }

    return true;
  }

  if (auth.isBootstrap) {
    return { name: 'setup' };
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'dashboard' };
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' };
  }

  return true;
});
