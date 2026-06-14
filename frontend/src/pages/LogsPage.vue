<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">GET /api/logs/recent</p>
          <h2>Runtime logs</h2>
        </div>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
          Обновить
        </button>
      </div>

      <div class="filter-row">
        <select v-model="scope" class="filter-input compact">
          <option value="">All scopes</option>
          <option value="worker">worker</option>
          <option value="playlist">playlist</option>
          <option value="channel">channel</option>
          <option value="ffmpeg">ffmpeg</option>
          <option value="telegram">telegram</option>
          <option value="auth">auth</option>
          <option value="system">system</option>
        </select>
      </div>

      <RuntimeLogList :logs="logs" />
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import RuntimeLogList from '../components/RuntimeLogList.vue';
import { getRecentLogs, type RuntimeLogEntry } from '../services/api';

const logs = ref<RuntimeLogEntry[]>([]);
const loading = ref(false);
const scope = ref<RuntimeLogEntry['scope'] | ''>('');

onMounted(() => {
  void refresh();
});

watch(scope, () => {
  void refresh();
});

async function refresh() {
  loading.value = true;

  try {
    const response = await getRecentLogs({
      scope: scope.value || undefined,
      limit: 200,
    });
    logs.value = response.items;
  } finally {
    loading.value = false;
  }
}
</script>
