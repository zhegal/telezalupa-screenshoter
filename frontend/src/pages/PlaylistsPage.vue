<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Источник: {{ sourceLabel }}</p>
          <h2>Плейлисты</h2>
        </div>
        <div class="control-row">
          <button v-if="sourceLabel === 'Database'" class="action-button" type="button" @click="openCreateModal">
            Добавить плейлист
          </button>
          <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
            Обновить
          </button>
        </div>
      </div>

      <p class="catalog-warning">
        {{ sourceLabel === 'Database'
          ? 'Основной список плейлистов. Откройте плейлист, чтобы управлять каналами внутри него.'
          : 'Активен JSON source: список доступен только для просмотра. Для редактирования переключите источник на Database.' }}
      </p>

      <div class="table-wrap">
        <table v-if="sourceLabel === 'Database'" class="runtime-table">
          <thead>
            <tr>
              <th>Плейлист</th>
              <th>Каналы</th>
              <th>Доступно сейчас</th>
              <th>Очередь</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="playlist in playlists" :key="playlist.url">
              <td>
                <RouterLink v-if="playlist.id" class="table-link" :to="`/catalog/playlists/${playlist.id}`">
                  {{ playlist.title || playlist.url }}
                </RouterLink>
              </td>
              <td>{{ playlist.channelsCount }}</td>
              <td>{{ playlist.availableChannelsCount }}</td>
              <td>{{ playlist.queueLeft }}</td>
              <td class="row-actions">
                <div class="row-actions__inner row-actions__inner--grouped">
                  <RouterLink v-if="playlist.id" class="ghost-button control-button" :to="`/catalog/playlists/${playlist.id}`">
                    Открыть
                  </RouterLink>
                  <button v-if="playlist.id" class="ghost-button control-button danger" type="button" @click="removePlaylist(playlist)">
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="playlists.length === 0">
              <td colspan="5" class="empty-cell">Нет плейлистов</td>
            </tr>
          </tbody>
        </table>

        <table v-else class="runtime-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Loaded</th>
              <th>Каналы</th>
              <th>Доступно сейчас</th>
              <th>Очередь</th>
              <th>Последняя загрузка</th>
              <th>Ошибка</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="playlist in playlists" :key="playlist.url">
              <td class="details-cell">{{ playlist.url }}</td>
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
              <td colspan="7" class="empty-cell">Плейлисты не загружены</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="createModalOpen" class="modal-backdrop" role="presentation" @click.self="closeCreateModal">
      <form class="catalog-form catalog-modal small-modal" @submit.prevent="createPlaylist">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Плейлист</p>
            <h2>Новый плейлист</h2>
          </div>
          <button class="ghost-button control-button" type="button" @click="closeCreateModal">Отмена</button>
        </div>
        <section class="form-section">
          <h3>Основное</h3>
          <div class="form-section-fields">
            <label>Название<input v-model="playlistForm.title" /></label>
            <label>Priority<input v-model="playlistForm.priority" type="number" /></label>
            <label class="toggle-line status-toggle"><input v-model="playlistForm.enabled" type="checkbox" /><span>Активен</span></label>
          </div>
        </section>
        <div class="modal-actions">
          <button class="ghost-button control-button" type="button" @click="closeCreateModal">Отмена</button>
          <button class="action-button" type="submit" :disabled="loading">Сохранить</button>
        </div>
      </form>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import { createCatalog, deleteCatalog, getRuntimePlaylists, type RuntimePlaylist } from '../services/api';

const playlists = ref<RuntimePlaylist[]>([]);
const loading = ref(false);
const sourceLabel = ref('JSON');
const createModalOpen = ref(false);
const playlistForm = reactive({
  title: '',
  priority: '0',
  enabled: true,
});

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;

  try {
    const response = await getRuntimePlaylists();
    playlists.value = response.items;
    sourceLabel.value = response.source === 'database' ? 'Database' : 'JSON';
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  playlistForm.title = '';
  playlistForm.priority = '0';
  playlistForm.enabled = true;
  createModalOpen.value = true;
}

function closeCreateModal() {
  createModalOpen.value = false;
}

async function createPlaylist() {
  if (!playlistForm.title.trim()) return;
  await createCatalog('playlists', {
    title: playlistForm.title,
    priority: Number(playlistForm.priority || 0),
    enabled: playlistForm.enabled,
  });
  closeCreateModal();
  await refresh();
}

async function removePlaylist(playlist: RuntimePlaylist) {
  if (!playlist.id) return;
  if (!window.confirm(`Удалить плейлист "${playlist.title || playlist.url}" и все его каналы?`)) return;
  await deleteCatalog('playlists', playlist.id);
  await refresh();
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}
</script>
