import { createRouter, createWebHistory } from 'vue-router';
import DashboardPage from '../pages/DashboardPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import NotFoundPage from '../pages/NotFoundPage.vue';
import SetupPage from '../pages/SetupPage.vue';
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
      component: DashboardPage,
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
      component: DashboardPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/channels',
      name: 'channels',
      component: DashboardPage,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: DashboardPage,
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
