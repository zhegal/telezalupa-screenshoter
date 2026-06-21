<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Playlist</p>
          <h2>{{ playlist?.title || 'Playlist' }}</h2>
        </div>
        <RouterLink class="ghost-button control-button" to="/catalog">Назад</RouterLink>
      </div>

      <div class="editor-tabs">
        <button v-for="tab in tabs" :key="tab.id" class="ghost-button control-button" :class="{ active: activeTab === tab.id }" type="button" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>

    <section v-if="activeTab === 'basic'" class="panel wide-panel">
      <form class="catalog-form compact-editor" @submit.prevent="savePlaylist">
        <label>
          Title
          <input v-model="playlistForm.title" />
        </label>
        <label>
          Priority
          <input v-model="playlistForm.priority" type="number" />
        </label>
        <label class="toggle-line status-toggle">
          <input v-model="playlistForm.enabled" type="checkbox" />
          <span>Активен</span>
        </label>
        <div class="modal-actions">
          <button class="action-button" type="submit" :disabled="loading">Сохранить</button>
        </div>
      </form>
    </section>

    <section v-if="activeTab === 'channels'" class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Playlist channels</p>
          <h2>Каналы плейлиста</h2>
        </div>
        <button class="action-button" type="button" @click="openChannelModal">Добавить канал</button>
      </div>

      <div class="playlist-list-toolbar">
        <div class="playlist-list-stats">
          <span class="pill level-info">Каналов: {{ channelRelations.length }}</span>
          <span class="pill level-info">Потоков: {{ totalChannelStreams }}</span>
          <span class="pill level-info">Таймзон: {{ totalChannelTimezones }}</span>
        </div>

        <div v-if="selectedChannelIds.size > 0" class="bulk-actions-bar" aria-live="polite">
          <span class="bulk-actions-count">
            <input :checked="allVisibleChannelsSelected" type="checkbox" @change="toggleAllVisibleChannels(($event.target as HTMLInputElement).checked)" />
            {{ selectedChannelIds.size }} выбрано
          </span>
          <span class="bulk-actions-buttons">
            <button class="ghost-button control-button danger" type="button" @click="deleteSelectedChannels">Удалить</button>
            <button class="ghost-button control-button" type="button" @click="copySelectedChannels">Копировать</button>
          </span>
        </div>
      </div>

      <div class="table-wrap">
        <table class="runtime-table playlist-channel-table">
          <thead>
            <tr>
              <th class="select-column">
                <input
                  :checked="allVisibleChannelsSelected"
                  :disabled="channelRelations.length === 0"
                  type="checkbox"
                  aria-label="Выделить все видимые каналы"
                  @change="toggleAllVisibleChannels(($event.target as HTMLInputElement).checked)"
                />
              </th>
              <th>Название</th>
              <th>Описание</th>
              <th>Streams</th>
              <th>Timezones</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="relation in channelRelations" :key="relation.id">
              <td class="select-column">
                <input :checked="selectedChannelIds.has(channelOf(relation).id)" type="checkbox" @change="toggleChannel(channelOf(relation).id, ($event.target as HTMLInputElement).checked)" />
              </td>
              <td><strong>{{ channelOf(relation).title }}</strong></td>
              <td class="truncate">{{ channelOf(relation).description || '—' }}</td>
              <td>{{ countOf(channelOf(relation), 'channelStreams') }}</td>
              <td>{{ countOf(channelOf(relation), 'channelTimezones') }}</td>
              <td>
                <span class="pill" :class="channelOf(relation).enabled === false ? 'level-warn' : 'level-info'">{{ channelOf(relation).enabled === false ? 'disabled' : 'enabled' }}</span>
              </td>
              <td class="row-actions">
                <div class="row-actions__inner row-actions__inner--grouped">
                  <button class="ghost-button control-button" type="button" @click="copyChannel(channelOf(relation).id)">Копировать</button>
                  <button class="ghost-button control-button" type="button" @click="openMoveModal(channelOf(relation).id)">Перенести</button>
                  <button class="ghost-button control-button danger" type="button" @click="deleteChannel(channelOf(relation).id)">Удалить</button>
                </div>
              </td>
            </tr>
            <tr v-if="channelRelations.length === 0">
              <td colspan="7" class="empty-cell">Нет каналов</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="activeTab === 'timezones'" class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Fallback таймзоны</p>
          <h2>Таймзоны</h2>
        </div>
        <button class="action-button" type="button" :disabled="!timezoneId" @click="addPlaylistTimezone">Добавить таймзону</button>
      </div>
      <p class="catalog-warning">Таймзоны плейлиста используются как fallback для каналов без собственных таймзон.</p>
      <div class="filter-row">
        <select v-model="timezoneId" class="filter-input">
          <option value="">Выберите таймзону</option>
          <option v-for="timezone in timezones" :key="timezone.id" :value="timezone.id">{{ displayTitle(timezone) }}</option>
        </select>
        <input v-model="timezonePriority" class="filter-input compact" type="number" placeholder="Priority" />
      </div>
      <div class="table-wrap">
        <table class="runtime-table compact-table">
          <thead>
            <tr>
              <th>Таймзона</th>
              <th>Priority</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="link in playlistTimezoneRelations" :key="link.id">
              <td>{{ displayTitle(timezoneOf(link)) }}</td>
              <td>
                <input
                  class="inline-input"
                  type="number"
                  :value="link.priority ?? 0"
                  @change="updatePlaylistTimezonePriority(link, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td class="row-actions">
                <button class="ghost-button danger" type="button" @click="deletePlaylistTimezone(link.id)">Удалить</button>
              </td>
            </tr>
            <tr v-if="playlistTimezoneRelations.length === 0">
              <td colspan="3" class="empty-cell">Fallback таймзоны не заданы</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="channelModalOpen" class="modal-backdrop" role="presentation" @click.self="closeChannelModal">
      <form class="catalog-form catalog-modal" @submit.prevent="createChannel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Playlist channel</p>
            <h2>Добавить канал</h2>
          </div>
          <button class="ghost-button control-button" type="button" @click="closeChannelModal">Cancel</button>
        </div>
        <section class="form-section">
          <h3>Основное</h3>
          <div class="form-section-fields">
            <label>Название<input v-model="channelForm.title" /></label>
            <label>Описание<textarea v-model="channelForm.description" /></label>
            <label class="toggle-line status-toggle"><input v-model="channelForm.enabled" type="checkbox" /><span>Активен</span></label>
          </div>
        </section>
        <section class="form-section">
          <h3>Поток</h3>
          <div class="form-section-fields">
            <label class="toggle-line status-toggle"><input v-model="channelForm.streamType" type="radio" value="direct" /><span>Direct URL</span></label>
            <label class="toggle-line status-toggle"><input v-model="channelForm.streamType" type="radio" value="provider" /><span>Provider + Stream Key</span></label>
            <template v-if="channelForm.streamType === 'direct'">
              <label>URL<input v-model="channelForm.directUrl" /></label>
            </template>
            <template v-else>
              <label>Provider<select v-model="channelForm.providerId"><option value="">Выберите Provider</option><option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ displayTitle(provider) }}</option></select></label>
              <button class="ghost-button control-button" type="button" @click="providerModalOpen = true">Создать Provider</button>
              <label>Stream Key<input v-model="channelForm.streamKey" /></label>
            </template>
            <label>User-Agent<input v-model="channelForm.userAgent" /></label>
          </div>
        </section>
        <section class="form-section">
          <h3>Таймзоны</h3>
          <div class="bulk-list compact-bulk-list">
            <label v-for="timezone in timezones" :key="timezone.id" class="bulk-option">
              <input :checked="channelForm.timezonePresetIds.includes(timezone.id)" type="checkbox" @change="toggleTimezone(timezone.id, ($event.target as HTMLInputElement).checked)" />
              <span>{{ displayTitle(timezone) }}</span>
            </label>
          </div>
          <button class="ghost-button control-button" type="button" @click="timezoneModalOpen = true">Создать таймзону</button>
        </section>
        <div class="modal-actions">
          <button class="ghost-button control-button" type="button" @click="closeChannelModal">Отмена</button>
          <button class="action-button" type="submit" :disabled="loading">Сохранить</button>
        </div>
      </form>
    </div>

    <div v-if="providerModalOpen" class="modal-backdrop" role="presentation" @click.self="providerModalOpen = false">
      <form class="catalog-form catalog-modal small-modal" @submit.prevent="createProvider">
        <h2>Создать Provider</h2>
        <label>Название<input v-model="providerForm.title" /></label>
        <label>URL template<input v-model="providerForm.urlTemplate" placeholder="https://host/{streamKey}" /></label>
        <div class="modal-actions"><button class="ghost-button control-button" type="button" @click="providerModalOpen = false">Отмена</button><button class="action-button" type="submit">Сохранить</button></div>
      </form>
    </div>

    <div v-if="timezoneModalOpen" class="modal-backdrop" role="presentation" @click.self="timezoneModalOpen = false">
      <form class="catalog-form catalog-modal small-modal" @submit.prevent="createTimezone">
        <h2>Создать таймзону</h2>
        <label>Timezone<input v-model="timezoneForm.timezone" placeholder="Europe/Kyiv" /></label>
        <label>Label<input v-model="timezoneForm.label" /></label>
        <div class="modal-actions"><button class="ghost-button control-button" type="button" @click="timezoneModalOpen = false">Отмена</button><button class="action-button" type="submit">Сохранить</button></div>
      </form>
    </div>

    <div v-if="moveModalOpen" class="modal-backdrop" role="presentation" @click.self="moveModalOpen = false">
      <form class="catalog-form catalog-modal small-modal" @submit.prevent="moveChannel">
        <h2>Перенести канал</h2>
        <label>Playlist<select v-model="moveTargetPlaylistId"><option value="">Выберите Playlist</option><option v-for="item in playlists" :key="item.id" :value="item.id">{{ displayTitle(item) }}</option></select></label>
        <div class="modal-actions"><button class="ghost-button control-button" type="button" @click="moveModalOpen = false">Отмена</button><button class="action-button" type="submit">Перенести</button></div>
      </form>
    </div>

    <div v-if="copyModalOpen" class="modal-backdrop" role="presentation" @click.self="copyModalOpen = false">
      <form class="catalog-form catalog-modal small-modal" @submit.prevent="copyChannels">
        <h2>Копировать канал</h2>
        <label>Playlist<select v-model="copyTargetPlaylistId"><option value="">Выберите Playlist</option><option :value="playlistId">Текущий Playlist</option><option v-for="item in playlists" :key="item.id" :value="item.id">{{ displayTitle(item) }}</option></select></label>
        <div class="modal-actions"><button class="ghost-button control-button" type="button" @click="copyModalOpen = false">Отмена</button><button class="action-button" type="submit">Копировать</button></div>
      </form>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import AdminLayout from '../../layouts/AdminLayout.vue';
import {
  bulkDeletePlaylistOwnedChannels,
  copyPlaylistOwnedChannel,
  createCatalog,
  createCatalogRelation,
  createPlaylistOwnedChannel,
  deleteCatalogRelation,
  deletePlaylistOwnedChannel,
  getCatalog,
  listCatalog,
  listCatalogRelation,
  movePlaylistOwnedChannel,
  updateCatalog,
  updateCatalogRelation,
  type CatalogItem,
} from '../../services/api';

const route = useRoute();
const playlistId = String(route.params.id);
const tabs = [
  { id: 'basic', label: 'Основное' },
  { id: 'channels', label: 'Каналы' },
  { id: 'timezones', label: 'Таймзоны' },
] as const;

const activeTab = ref<(typeof tabs)[number]['id']>('channels');
const playlist = ref<CatalogItem | null>(null);
const channelRelations = ref<CatalogItem[]>([]);
const playlistTimezoneRelations = ref<CatalogItem[]>([]);
const providers = ref<CatalogItem[]>([]);
const timezones = ref<CatalogItem[]>([]);
const playlists = ref<CatalogItem[]>([]);
const selectedChannelIds = reactive(new Set<string>());
const loading = ref(false);
const error = ref('');
const channelModalOpen = ref(false);
const providerModalOpen = ref(false);
const timezoneModalOpen = ref(false);
const moveModalOpen = ref(false);
const copyModalOpen = ref(false);
const movingChannelId = ref('');
const moveTargetPlaylistId = ref('');
const copyingChannelIds = ref<string[]>([]);
const copyTargetPlaylistId = ref('');
const timezoneId = ref('');
const timezonePriority = ref('0');
const playlistForm = reactive({ title: '', priority: '0', enabled: true });
const channelForm = reactive({
  title: '',
  description: '',
  enabled: true,
  streamType: 'direct',
  directUrl: '',
  providerId: '',
  streamKey: '',
  userAgent: '',
  timezonePresetIds: [] as string[],
});
const providerForm = reactive({ title: '', urlTemplate: '' });
const timezoneForm = reactive({ timezone: '', label: '' });
const visibleChannelIds = computed(() => channelRelations.value.map((relation) => channelOf(relation).id));
const allVisibleChannelsSelected = computed(
  () => visibleChannelIds.value.length > 0 && visibleChannelIds.value.every((id) => selectedChannelIds.has(id)),
);
const totalChannelStreams = computed(() =>
  channelRelations.value.reduce((total, relation) => total + countOf(channelOf(relation), 'channelStreams'), 0),
);
const totalChannelTimezones = computed(() =>
  channelRelations.value.reduce((total, relation) => total + countOf(channelOf(relation), 'channelTimezones'), 0),
);

onMounted(() => void loadAll());

async function loadAll() {
  loading.value = true;
  error.value = '';
  try {
    const [
      playlistResponse,
      relationResponse,
      playlistTimezoneResponse,
      providerResponse,
      timezoneResponse,
      playlistListResponse,
    ] = await Promise.all([
      getCatalog('playlists', playlistId),
      listCatalogRelation(`playlists/${playlistId}/channels`),
      listCatalogRelation(`playlists/${playlistId}/timezones`),
      listCatalog('providers', { limit: 200, enabled: 'true' }),
      listCatalog('timezones', { limit: 200 }),
      listCatalog('playlists', { limit: 200 }),
    ]);
    playlist.value = playlistResponse;
    playlistForm.title = String(playlistResponse.title || '');
    playlistForm.priority = String(playlistResponse.priority ?? 0);
    playlistForm.enabled = playlistResponse.enabled !== false;
    channelRelations.value = relationResponse.items;
    playlistTimezoneRelations.value = playlistTimezoneResponse.items;
    providers.value = providerResponse.items;
    timezones.value = timezoneResponse.items;
    playlists.value = playlistListResponse.items.filter((item) => item.id !== playlistId);
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function savePlaylist() {
  await updateCatalog('playlists', playlistId, {
    title: playlistForm.title,
    priority: Number(playlistForm.priority || 0),
    enabled: playlistForm.enabled,
  });
  await loadAll();
}

function openChannelModal() {
  Object.assign(channelForm, {
    title: '',
    description: '',
    enabled: true,
    streamType: 'direct',
    directUrl: '',
    providerId: '',
    streamKey: '',
    userAgent: '',
    timezonePresetIds: [],
  });
  channelModalOpen.value = true;
}

function closeChannelModal() {
  channelModalOpen.value = false;
}

async function createChannel() {
  await createPlaylistOwnedChannel(playlistId, { ...channelForm });
  closeChannelModal();
  await loadAll();
}

async function deleteChannel(channelId: string) {
  if (!window.confirm('Удалить канал и его потоки?')) return;
  await deletePlaylistOwnedChannel(playlistId, channelId);
  selectedChannelIds.delete(channelId);
  await loadAll();
}

async function deleteSelectedChannels() {
  if (!window.confirm(`Удалить выбранные каналы: ${selectedChannelIds.size}?`)) return;
  await bulkDeletePlaylistOwnedChannels(playlistId, Array.from(selectedChannelIds));
  selectedChannelIds.clear();
  await loadAll();
}

async function copyChannel(channelId: string) {
  copyingChannelIds.value = [channelId];
  copyTargetPlaylistId.value = '';
  copyModalOpen.value = true;
}

async function copySelectedChannels() {
  copyingChannelIds.value = Array.from(selectedChannelIds);
  copyTargetPlaylistId.value = '';
  copyModalOpen.value = true;
}

async function copyChannels() {
  if (!copyTargetPlaylistId.value) return;
  for (const channelId of copyingChannelIds.value) {
    await copyPlaylistOwnedChannel(playlistId, channelId, copyTargetPlaylistId.value);
  }
  selectedChannelIds.clear();
  copyModalOpen.value = false;
  await loadAll();
}

function openMoveModal(channelId: string) {
  movingChannelId.value = channelId;
  moveTargetPlaylistId.value = '';
  moveModalOpen.value = true;
}

async function moveChannel() {
  if (!moveTargetPlaylistId.value) return;
  await movePlaylistOwnedChannel(playlistId, movingChannelId.value, moveTargetPlaylistId.value);
  moveModalOpen.value = false;
  await loadAll();
}

async function createProvider() {
  const provider = await createCatalog('providers', {
    title: providerForm.title,
    urlTemplate: providerForm.urlTemplate,
    enabled: true,
  });
  await loadAll();
  channelForm.providerId = provider.id;
  providerModalOpen.value = false;
}

async function createTimezone() {
  const timezone = await createCatalog('timezones', {
    timezone: timezoneForm.timezone,
    label: timezoneForm.label,
    enabled: true,
    priority: 0,
  });
  await loadAll();
  channelForm.timezonePresetIds.push(timezone.id);
  timezoneModalOpen.value = false;
}

async function addPlaylistTimezone() {
  if (!timezoneId.value) return;
  await createCatalogRelation(`playlists/${playlistId}/timezones`, {
    timezonePresetId: timezoneId.value,
    priority: Number(timezonePriority.value || 0),
  });
  timezoneId.value = '';
  timezonePriority.value = '0';
  await loadAll();
}

async function updatePlaylistTimezonePriority(link: CatalogItem, priority: string) {
  await updateCatalogRelation(`playlists/${playlistId}/timezones`, link.id, {
    priority: Number(priority || 0),
  });
  await loadAll();
}

async function deletePlaylistTimezone(linkId: string) {
  await deleteCatalogRelation(`playlists/${playlistId}/timezones`, linkId);
  await loadAll();
}

function toggleChannel(channelId: string, checked: boolean) {
  if (checked) selectedChannelIds.add(channelId);
  else selectedChannelIds.delete(channelId);
}

function toggleAllVisibleChannels(checked: boolean) {
  for (const channelId of visibleChannelIds.value) {
    if (checked) selectedChannelIds.add(channelId);
    else selectedChannelIds.delete(channelId);
  }
}

function toggleTimezone(id: string, checked: boolean) {
  if (checked && !channelForm.timezonePresetIds.includes(id)) channelForm.timezonePresetIds.push(id);
  if (!checked) channelForm.timezonePresetIds = channelForm.timezonePresetIds.filter((item) => item !== id);
}

function channelOf(relation: CatalogItem) {
  return relation.channel as CatalogItem;
}

function timezoneOf(relation: CatalogItem) {
  return relation.timezonePreset as CatalogItem;
}

function countOf(item: CatalogItem, key: string) {
  const count = item._count as Record<string, number> | undefined;
  return count?.[key] ?? 0;
}

function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.id);
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
</script>
