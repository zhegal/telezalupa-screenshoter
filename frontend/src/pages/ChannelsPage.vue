<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Источник: {{ sourceLabel }}</p>
          <h2>Поиск каналов</h2>
        </div>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
          Обновить
        </button>
      </div>

      <p class="catalog-warning">
        Найдите канал из Telegram-поста по названию и откройте его редактирование. Основное управление каналами находится внутри плейлиста.
      </p>

      <div class="filter-row">
        <input v-model="search" class="filter-input" type="search" placeholder="Поиск по названию" @keydown.enter="refresh" />
        <select v-model="filter" class="filter-input compact" @change="refresh">
          <option value="all">Все</option>
          <option value="available">Доступны сейчас</option>
          <option value="errors">Errors</option>
        </select>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
          Найти
        </button>
      </div>

      <div class="table-wrap">
        <table class="runtime-table">
          <thead>
            <tr>
              <th>Канал</th>
              <th>Доступен</th>
              <th>Delay</th>
              <th>Scale</th>
              <th>User-Agent</th>
              <th>Последняя попытка</th>
              <th>Ошибки</th>
              <th>Плейлист</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="channel in channels" :key="`${channel.playlistUrl}:${channel.title}:${channel.url}`">
              <td>
                <RouterLink v-if="sourceLabel === 'Database' && channel.channelId" class="table-link" :to="`/catalog/channels/${channel.channelId}`">
                  {{ channel.title }}
                </RouterLink>
                <strong v-else>{{ channel.title }}</strong>
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
              <td>
                <RouterLink
                  v-if="sourceLabel === 'Database' && channel.playlistId"
                  class="table-link"
                  :to="`/catalog/playlists/${channel.playlistId}`"
                >
                  {{ channel.playlistTitle || channel.playlistUrl }}
                </RouterLink>
                <span v-else class="details-cell">{{ channel.playlistUrl }}</span>
              </td>
            </tr>
            <tr v-if="channels.length === 0">
              <td colspan="8" class="empty-cell">Каналы не найдены</td>
            </tr>
          </tbody>
        </table>
      </div>
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
import { getRuntimeChannels, type RuntimeChannel } from '../services/api';

const channels = ref<RuntimeChannel[]>([]);
const loading = ref(false);
const search = ref('');
const filter = ref<'all' | 'available' | 'errors'>('all');
const total = ref(0);
const offset = ref(0);
const pageSize = ref(Number(localStorage.getItem('runtimeChannelsPageSize') || 50));
const sourceLabel = ref('JSON');

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;

  try {
    const response = await getRuntimeChannels({
      search: search.value,
      filter: filter.value === 'all' ? '' : filter.value,
      limit: pageSize.value,
      offset: offset.value,
    });
    channels.value = response.items;
    total.value = response.total || response.items.length;
    sourceLabel.value = response.source === 'database' ? 'Database' : 'JSON';
  } finally {
    loading.value = false;
  }
}

async function changePage(nextOffset: number) {
  offset.value = nextOffset;
  await refresh();
}

async function changePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize;
  localStorage.setItem('runtimeChannelsPageSize', String(nextPageSize));
  offset.value = 0;
  await refresh();
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}
</script>
