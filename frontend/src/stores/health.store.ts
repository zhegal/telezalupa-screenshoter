import { defineStore } from 'pinia';
import { getHealth, type HealthResponse } from '../services/api';

interface HealthState {
  data: HealthResponse | null;
  loading: boolean;
  error: string | null;
  checkedAt: string | null;
}

export const useHealthStore = defineStore('health', {
  state: (): HealthState => ({
    data: null,
    loading: false,
    error: null,
    checkedAt: null,
  }),
  getters: {
    isOnline: (state) => state.data?.status === 'ok' && !state.error,
  },
  actions: {
    async refresh() {
      this.loading = true;
      this.error = null;

      try {
        this.data = await getHealth();
        this.checkedAt = new Date().toLocaleString('ru-RU');
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },
  },
});
