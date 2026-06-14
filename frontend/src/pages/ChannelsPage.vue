<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Read-only runtime channels из JSON/cache</p>
          <h2>Channels</h2>
        </div>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
          Обновить
        </button>
      </div>

      <div class="filter-row">
        <input v-model="search" class="filter-input" type="search" placeholder="Поиск по названию" />
        <select v-model="filter" class="filter-input compact">
          <option value="all">All</option>
          <option value="available">Available now</option>
          <option value="errors">Errors</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="runtime-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Available</th>
              <th>Delay</th>
              <th>Scale</th>
              <th>User-Agent</th>
              <th>Last attempt</th>
              <th>Failures</th>
              <th>Playlist</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="channel in filteredChannels" :key="`${channel.playlistUrl}:${channel.url}`">
              <td>
                <strong>{{ channel.title }}</strong>
                <small>{{ channel.description }}</small>
              </td>
              <td>
                <span class="pill" :class="channel.availableNow ? 'level-info' : 'level-warn'">
                  {{ channel.availableNow ? 'yes' : 'no' }}
                </span>
              </td>
              <td>{{ channel.delay ?? '—' }}</td>
              <td>{{ channel.scale }}</td>
              <td class="truncate">{{ channel.userAgent || '—' }}</td>
              <td>{{ formatDate(channel.lastAttemptAt) }}</td>
              <td>
                <span class="pill" :class="channel.consecutiveFailures ? 'level-error' : 'level-info'">
                  {{ channel.consecutiveFailures }}
                </span>
              </td>
              <td class="truncate">{{ channel.playlistUrl }}</td>
            </tr>
            <tr v-if="filteredChannels.length === 0">
              <td colspan="8" class="empty-cell">No channels match filters</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import { getRuntimeChannels, type RuntimeChannel } from '../services/api';

const channels = ref<RuntimeChannel[]>([]);
const loading = ref(false);
const search = ref('');
const filter = ref<'all' | 'available' | 'errors'>('all');

const filteredChannels = computed(() => {
  const query = search.value.trim().toLowerCase();

  return channels.value.filter((channel) => {
    const matchesSearch = !query || channel.title.toLowerCase().includes(query);
    const matchesFilter =
      filter.value === 'all' ||
      (filter.value === 'available' && channel.availableNow) ||
      (filter.value === 'errors' && Boolean(channel.lastErrorAt || channel.consecutiveFailures));

    return matchesSearch && matchesFilter;
  });
});

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;

  try {
    const response = await getRuntimeChannels();
    channels.value = response.items;
  } finally {
    loading.value = false;
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}
</script>
