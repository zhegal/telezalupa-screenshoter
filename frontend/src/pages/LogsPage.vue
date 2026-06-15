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
        <select v-model="scope" class="filter-input compact" @change="applyFilters">
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
      <PaginationControls
        :total="total"
        :offset="offset"
        :page-size="pageSize"
        @change-page="changePage"
        @change-page-size="changePageSize"
      />
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import PaginationControls from '../components/PaginationControls.vue';
import RuntimeLogList from '../components/RuntimeLogList.vue';
import { getRecentLogs, type RuntimeLogEntry } from '../services/api';

const logs = ref<RuntimeLogEntry[]>([]);
const loading = ref(false);
const scope = ref<RuntimeLogEntry['scope'] | ''>('');
const total = ref(0);
const offset = ref(0);
const pageSize = ref(Number(localStorage.getItem('logsPageSize') || 50));

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;

  try {
    const response = await getRecentLogs({
      scope: scope.value || undefined,
      limit: pageSize.value,
      offset: offset.value,
    });
    logs.value = response.items;
    total.value = response.total;
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  offset.value = 0;
  await refresh();
}

async function changePage(nextOffset: number) {
  offset.value = nextOffset;
  await refresh();
}

async function changePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize;
  localStorage.setItem('logsPageSize', String(nextPageSize));
  offset.value = 0;
  await refresh();
}
</script>
