<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Источник: data/playlists.json</p>
          <h2>Runtime playlists</h2>
        </div>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
          Обновить
        </button>
      </div>

      <div class="table-wrap">
        <table class="runtime-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Loaded</th>
              <th>Channels</th>
              <th>Available</th>
              <th>Queue</th>
              <th>Last loaded</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="playlist in playlists" :key="playlist.url">
              <td class="truncate">{{ playlist.url }}</td>
              <td>
                <span class="pill" :class="playlist.loaded ? 'level-info' : 'level-warn'">
                  {{ playlist.loading ? 'loading' : playlist.loaded ? 'yes' : 'no' }}
                </span>
              </td>
              <td>{{ playlist.channelsCount }}</td>
              <td>{{ playlist.availableChannelsCount }}</td>
              <td>{{ playlist.queueLeft }}</td>
              <td>{{ formatDate(playlist.lastLoadedAt) }}</td>
              <td class="truncate">{{ playlist.lastLoadError || '—' }}</td>
            </tr>
            <tr v-if="playlists.length === 0">
              <td colspan="7" class="empty-cell">No playlists loaded</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import { getRuntimePlaylists, type RuntimePlaylist } from '../services/api';

const playlists = ref<RuntimePlaylist[]>([]);
const loading = ref(false);

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;

  try {
    const response = await getRuntimePlaylists();
    playlists.value = response.items;
  } finally {
    loading.value = false;
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}
</script>
