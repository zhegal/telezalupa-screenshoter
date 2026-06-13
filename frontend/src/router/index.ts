import { createRouter, createWebHistory } from 'vue-router';
import DashboardPage from '../pages/DashboardPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardPage,
      meta: {
        requiresAuth: false,
      },
    },
    {
      path: '/worker',
      name: 'worker',
      component: DashboardPage,
      meta: {
        requiresAuth: false,
      },
    },
    {
      path: '/telegram',
      name: 'telegram',
      component: DashboardPage,
      meta: {
        requiresAuth: false,
      },
    },
    {
      path: '/playlists',
      name: 'playlists',
      component: DashboardPage,
      meta: {
        requiresAuth: false,
      },
    },
    {
      path: '/channels',
      name: 'channels',
      component: DashboardPage,
      meta: {
        requiresAuth: false,
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: DashboardPage,
      meta: {
        requiresAuth: false,
      },
    },
  ],
});
