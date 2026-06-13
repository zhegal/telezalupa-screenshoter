import { defineStore } from 'pinia';
import {
  getBootstrapStatus,
  getMe,
  login,
  logout,
  setupFirstUser,
  type AuthUser,
  type BootstrapStatus,
  type LoginPayload,
  type SetupPayload,
} from '../services/api';

interface AuthStoreState {
  bootstrapStatus: BootstrapStatus | null;
  user: AuthUser | null;
  isBootstrap: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthStoreState => ({
    bootstrapStatus: null,
    user: null,
    isBootstrap: false,
    initialized: false,
    loading: false,
    error: null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user) || state.isBootstrap,
    setupAvailable: (state) =>
      Boolean(state.bootstrapStatus?.bootstrapAvailable) && state.isBootstrap,
    configError: (state) =>
      state.bootstrapStatus &&
      !state.bootstrapStatus.hasUsers &&
      !state.bootstrapStatus.tempAdminPasswordConfigured,
  },
  actions: {
    async initialize() {
      if (this.initialized) {
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        this.bootstrapStatus = await getBootstrapStatus();
        const me = await getMe();
        this.user = me.user;
        this.isBootstrap = me.isBootstrap;
        this.initialized = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
        this.initialized = true;
      } finally {
        this.loading = false;
      }
    },

    async login(payload: LoginPayload) {
      this.loading = true;
      this.error = null;

      try {
        const result = await login(payload);
        this.bootstrapStatus = await getBootstrapStatus();
        this.user = result.user;
        this.isBootstrap = result.isBootstrap;
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async setup(payload: SetupPayload) {
      this.loading = true;
      this.error = null;

      try {
        const result = await setupFirstUser(payload);
        this.bootstrapStatus = await getBootstrapStatus();
        this.user = result.user;
        this.isBootstrap = result.isBootstrap;
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      await logout();
      this.user = null;
      this.isBootstrap = false;
      this.initialized = false;
      await this.initialize();
    },
  },
});
