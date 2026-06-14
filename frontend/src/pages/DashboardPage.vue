<template>
  <AdminLayout>
    <div class="dashboard-grid">
      <HealthCard />

      <section class="panel overview-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">GET /api/system/status</p>
            <h2>Runtime</h2>
          </div>
          <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
            Обновить
          </button>
        </div>

        <dl class="meta-grid">
          <div>
            <dt>Source</dt>
            <dd>{{ system?.source || 'json' }}</dd>
          </div>
          <div>
            <dt>Worker</dt>
            <dd>{{ workerStatus }}</dd>
          </div>
          <div>
            <dt>Current channel</dt>
            <dd>{{ system?.worker.currentChannelTitle || '—' }}</dd>
          </div>
          <div>
            <dt>Current playlist</dt>
            <dd class="truncate">{{ system?.worker.currentPlaylistUrl || '—' }}</dd>
          </div>
          <div>
            <dt>Last success</dt>
            <dd>{{ formatDate(system?.worker.lastSuccessAt) }}</dd>
          </div>
          <div>
            <dt>Next run</dt>
            <dd>{{ formatDate(system?.worker.nextRunAt) }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Worker controls</p>
          <h2>Цикл скриншотера</h2>
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
        <div>
          <dt>Channel source</dt>
          <dd>JSON</dd>
        </div>
        <div>
          <dt>Database catalog</dt>
          <dd>available</dd>
        </div>
        <div>
          <dt>Cycles</dt>
          <dd>{{ system?.worker.cyclesCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Success</dt>
          <dd>{{ system?.worker.successCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Errors</dt>
          <dd>{{ system?.worker.errorCount ?? 0 }}</dd>
        </div>
      </dl>
    </section>

    <section class="sections-block" aria-labelledby="sections-title">
      <div class="section-heading">
        <p class="eyebrow">{{ t.futureSections }}</p>
        <h2 id="sections-title">{{ t.dashboard }}</h2>
      </div>

      <div class="section-grid">
        <SectionCard
          v-for="section in sections"
          :key="section.to"
          :to="section.to"
          :title="section.title"
          :description="section.description"
          :icon="section.icon"
        />
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import HealthCard from '../components/HealthCard.vue';
import SectionCard from '../components/SectionCard.vue';
import WorkerControls from '../components/WorkerControls.vue';
import { t } from '../services/i18n';
import {
  getSystemStatus,
  restartWorker,
  runWorkerOnce,
  startWorker,
  stopWorker,
  type SystemStatus,
} from '../services/api';
import type { AppIconName } from '../components/icons/icon.types';

const system = ref<SystemStatus | null>(null);
const loading = ref(false);
const actionLoading = ref(false);

const workerStatus = computed(() => {
  if (!system.value) {
    return '—';
  }

  return `${system.value.worker.running ? 'running' : 'stopped'} / ${system.value.worker.busy ? 'busy' : 'idle'}`;
});

const sections: { to: string; title: string; description: string; icon: AppIconName }[] = [
  {
    to: '/worker',
    title: t.sections.worker,
    description: t.sectionDescriptions.worker,
    icon: 'play',
  },
  {
    to: '/telegram',
    title: t.sections.telegram,
    description: t.sectionDescriptions.telegram,
    icon: 'send',
  },
  {
    to: '/playlists',
    title: t.sections.playlists,
    description: t.sectionDescriptions.playlists,
    icon: 'file-list',
  },
  {
    to: '/channels',
    title: t.sections.channels,
    description: t.sectionDescriptions.channels,
    icon: 'radio',
  },
  {
    to: '/catalog',
    title: t.sections.catalog,
    description: t.sectionDescriptions.catalog,
    icon: 'database',
  },
  {
    to: '/logs',
    title: t.sections.logs,
    description: t.sectionDescriptions.logs,
    icon: 'logs',
  },
];

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;

  try {
    system.value = await getSystemStatus();
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

    system.value = {
      ...(system.value || {
        status: 'ok',
        source: 'json',
        uptimeSeconds: 0,
        nodeVersion: '',
        now: new Date().toISOString(),
      }),
      worker: result.worker,
    };
  } finally {
    actionLoading.value = false;
  }
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}
</script>
