<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">GET /api/worker/status</p>
          <h2>Worker</h2>
        </div>
        <WorkerControls
          :loading="actionLoading"
          @start="runAction('start')"
          @stop="runAction('stop')"
          @restart="runAction('restart')"
          @run-once="runAction('runOnce')"
        />
      </div>

      <dl class="meta-grid metrics-grid">
        <div v-for="item in statusItems" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd :class="{ truncate: item.truncate }">{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">GET /api/logs/recent?scope=worker</p>
          <h2>Worker logs</h2>
        </div>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
          Обновить
        </button>
      </div>
      <RuntimeLogList :logs="logs" />
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import RuntimeLogList from '../components/RuntimeLogList.vue';
import WorkerControls from '../components/WorkerControls.vue';
import {
  getRecentLogs,
  getWorkerStatus,
  restartWorker,
  runWorkerOnce,
  startWorker,
  stopWorker,
  type RuntimeLogEntry,
  type WorkerStatus,
} from '../services/api';

const worker = ref<WorkerStatus | null>(null);
const logs = ref<RuntimeLogEntry[]>([]);
const loading = ref(false);
const actionLoading = ref(false);

const statusItems = computed(() => {
  const value = worker.value;

  return [
    { label: 'Running', value: value ? String(value.running) : '—' },
    { label: 'Busy', value: value ? String(value.busy) : '—' },
    { label: 'Source', value: value?.source || 'json' },
    { label: 'Current channel', value: value?.currentChannelTitle || '—', truncate: true },
    { label: 'Current playlist', value: value?.currentPlaylistUrl || '—', truncate: true },
    { label: 'Last channel', value: value?.lastChannelTitle || '—', truncate: true },
    { label: 'Last success', value: formatDate(value?.lastSuccessAt) },
    { label: 'Last error at', value: formatDate(value?.lastErrorAt) },
    { label: 'Last error', value: value?.lastErrorMessage || '—', truncate: true },
    { label: 'Next run', value: formatDate(value?.nextRunAt) },
    { label: 'Telegram message id', value: value?.lastTelegramMessageId ?? '—' },
    { label: 'Counters', value: `${value?.cyclesCount ?? 0} / ${value?.successCount ?? 0} / ${value?.errorCount ?? 0}` },
  ];
});

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;

  try {
    const [workerStatus, logResponse] = await Promise.all([
      getWorkerStatus(),
      getRecentLogs({ scope: 'worker', limit: 100 }),
    ]);

    worker.value = workerStatus;
    logs.value = logResponse.items;
  } finally {
    loading.value = false;
  }
}

async function runAction(action: 'start' | 'stop' | 'restart' | 'runOnce') {
  actionLoading.value = true;

  try {
    const result =
      action === 'start'
        ? await startWorker()
        : action === 'stop'
          ? await stopWorker()
          : action === 'restart'
            ? await restartWorker()
            : await runWorkerOnce();

    worker.value = result.worker;
    await refresh();
  } finally {
    actionLoading.value = false;
  }
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}
</script>
