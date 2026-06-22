<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Плейлист</p>
          <h2>{{ playlist?.title || 'Playlist' }}</h2>
        </div>
        <RouterLink class="ghost-button control-button" to="/playlists">Назад к плейлистам</RouterLink>
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
          Название
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
          <p class="eyebrow">Содержимое плейлиста</p>
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
              <th>Потоки</th>
              <th>Таймзоны</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="relation in channelRelations" :key="relation.id">
              <td class="select-column">
                <input :checked="selectedChannelIds.has(channelOf(relation).id)" type="checkbox" @change="toggleChannel(channelOf(relation).id, ($event.target as HTMLInputElement).checked)" />
              </td>
              <td>
                <button class="table-link table-link-button" type="button" @click="openEditChannelModal(channelOf(relation))">
                  {{ channelOf(relation).title }}
                </button>
              </td>
              <td class="truncate">{{ channelOf(relation).description || '—' }}</td>
              <td>{{ countOf(channelOf(relation), 'channelStreams') }}</td>
              <td>{{ countOf(channelOf(relation), 'channelTimezones') }}</td>
              <td>
                <span class="pill" :class="channelOf(relation).enabled === false ? 'level-warn' : 'level-info'">{{ channelOf(relation).enabled === false ? 'disabled' : 'enabled' }}</span>
              </td>
              <td class="row-actions">
                <div class="row-actions__inner row-actions__inner--grouped">
                  <button class="ghost-button icon-button" type="button" title="Скриншот" aria-label="Скриншот" @click="openScreenshotModal(channelOf(relation))">
                    <AppIcon name="camera" />
                  </button>
                  <button class="ghost-button icon-button" type="button" title="Копировать" aria-label="Копировать" @click="copyChannel(channelOf(relation).id)">
                    <AppIcon name="copy" />
                  </button>
                  <button class="ghost-button icon-button" type="button" title="Перенести" aria-label="Перенести" @click="openMoveModal(channelOf(relation).id)">
                    <AppIcon name="move" />
                  </button>
                  <button class="ghost-button icon-button danger" type="button" title="Удалить" aria-label="Удалить" @click="deleteChannel(channelOf(relation).id)">
                    <AppIcon name="trash" />
                  </button>
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
            <p class="eyebrow">Канал плейлиста</p>
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

    <div v-if="editChannelModalOpen" class="modal-backdrop" role="presentation" @click.self="closeEditChannelModal">
      <form class="catalog-form catalog-modal" @submit.prevent="saveEditedChannel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Канал плейлиста</p>
            <h2>Редактировать канал</h2>
          </div>
          <button class="ghost-button control-button" type="button" :disabled="editChannelSaving" @click="closeEditChannelModal">Cancel</button>
        </div>

        <section class="form-section">
          <h3>Основное</h3>
          <div class="form-section-fields">
            <label>Название<input v-model="editChannelForm.title" /></label>
            <label>Описание<textarea v-model="editChannelForm.description" /></label>
            <div class="form-grid two-columns">
              <label>Delay seconds<input v-model="editChannelForm.defaultDelaySeconds" type="number" /></label>
              <label>Scale<input v-model="editChannelForm.defaultScale" placeholder="1280:720" /></label>
            </div>
            <label class="toggle-line status-toggle"><input v-model="editChannelForm.enabled" type="checkbox" /><span>Активен в очереди</span></label>
          </div>
        </section>

        <section class="form-section">
          <div class="section-title-row">
            <h3>Потоки</h3>
            <button class="ghost-button control-button" type="button" @click="editNewStreamOpen = !editNewStreamOpen">Добавить поток</button>
          </div>
          <div class="form-section-fields">
            <div v-for="stream in editStreamForms" :key="stream.relationId" class="nested-form-block">
              <div class="section-title-row">
                <strong>{{ stream.title || 'Stream' }}</strong>
                <button class="ghost-button icon-button danger" type="button" title="Удалить поток" aria-label="Удалить поток" @click="deleteEditedStream(stream)">
                  <AppIcon name="trash" />
                </button>
              </div>
              <div class="form-grid two-columns">
                <label>Название<input v-model="stream.title" /></label>
                <label>Priority<input v-model="stream.priority" type="number" /></label>
              </div>
              <label class="toggle-line status-toggle"><input v-model="stream.enabled" type="checkbox" /><span>Активен в очереди</span></label>
              <label class="toggle-line status-toggle"><input v-model="stream.streamType" type="radio" value="direct" /><span>Direct URL</span></label>
              <label class="toggle-line status-toggle"><input v-model="stream.streamType" type="radio" value="provider" /><span>Provider + Stream Key</span></label>
              <template v-if="stream.streamType === 'direct'">
                <label>URL<input v-model="stream.directUrl" /></label>
              </template>
              <template v-else>
                <label>Provider<select v-model="stream.providerId"><option value="">Выберите Provider</option><option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ displayTitle(provider) }}</option></select></label>
                <label>Stream Key<input v-model="stream.streamKey" /></label>
              </template>
              <label>User-Agent<input v-model="stream.userAgent" /></label>
            </div>

            <div v-if="editNewStreamOpen" class="nested-form-block">
              <strong>Новый поток</strong>
              <div class="form-grid two-columns">
                <label>Название<input v-model="editNewStreamForm.title" /></label>
                <label>Priority<input v-model="editNewStreamForm.priority" type="number" /></label>
              </div>
              <label class="toggle-line status-toggle"><input v-model="editNewStreamForm.streamType" type="radio" value="direct" /><span>Direct URL</span></label>
              <label class="toggle-line status-toggle"><input v-model="editNewStreamForm.streamType" type="radio" value="provider" /><span>Provider + Stream Key</span></label>
              <template v-if="editNewStreamForm.streamType === 'direct'">
                <label>URL<input v-model="editNewStreamForm.directUrl" /></label>
              </template>
              <template v-else>
                <label>Provider<select v-model="editNewStreamForm.providerId"><option value="">Выберите Provider</option><option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ displayTitle(provider) }}</option></select></label>
                <label>Stream Key<input v-model="editNewStreamForm.streamKey" /></label>
              </template>
              <label>User-Agent<input v-model="editNewStreamForm.userAgent" /></label>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>Таймзоны</h3>
          <div class="bulk-list compact-bulk-list">
            <label v-for="timezone in timezones" :key="timezone.id" class="bulk-option">
              <input :checked="editChannelForm.timezonePresetIds.includes(timezone.id)" type="checkbox" @change="toggleEditTimezone(timezone.id, ($event.target as HTMLInputElement).checked)" />
              <span>{{ displayTitle(timezone) }}</span>
            </label>
          </div>
        </section>

        <p v-if="editChannelError" class="form-error">{{ editChannelError }}</p>
        <div class="modal-actions">
          <button class="ghost-button control-button" type="button" :disabled="editChannelSaving" @click="closeEditChannelModal">Отмена</button>
          <button class="action-button" type="submit" :disabled="editChannelSaving">{{ editChannelSaving ? 'Сохранение...' : 'Сохранить' }}</button>
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
        <label>Плейлист<select v-model="moveTargetPlaylistId"><option value="">Выберите плейлист</option><option v-for="item in playlists" :key="item.id" :value="item.id">{{ displayTitle(item) }}</option></select></label>
        <div class="modal-actions"><button class="ghost-button control-button" type="button" @click="moveModalOpen = false">Отмена</button><button class="action-button" type="submit">Перенести</button></div>
      </form>
    </div>

    <div v-if="copyModalOpen" class="modal-backdrop" role="presentation" @click.self="copyModalOpen = false">
      <form class="catalog-form catalog-modal small-modal" @submit.prevent="copyChannels">
        <h2>Копировать канал</h2>
        <label>Плейлист<select v-model="copyTargetPlaylistId"><option value="">Выберите плейлист</option><option :value="playlistId">Текущий плейлист</option><option v-for="item in playlists" :key="item.id" :value="item.id">{{ displayTitle(item) }}</option></select></label>
        <div class="modal-actions"><button class="ghost-button control-button" type="button" @click="copyModalOpen = false">Отмена</button><button class="action-button" type="submit">Копировать</button></div>
      </form>
    </div>

    <div v-if="screenshotModalOpen" class="modal-backdrop" role="presentation" @click.self="closeScreenshotModal">
      <form class="catalog-form catalog-modal small-modal" @submit.prevent="sendScreenshotNow">
        <h2>Отправить скриншот</h2>
        <p class="modal-subtitle">{{ screenshotChannelTitle }}</p>
        <p v-if="screenshotError" class="form-error">{{ screenshotError }}</p>
        <div class="modal-actions">
          <button class="ghost-button control-button" type="button" :disabled="screenshotSending" @click="closeScreenshotModal">Отмена</button>
          <button class="action-button" type="submit" :disabled="screenshotSending">
            {{ screenshotSending ? 'Отправка...' : 'Отправить сейчас' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="screenshotNotice" class="toast-popup" role="status" aria-live="polite">
      {{ screenshotNotice }}
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from '../../components/icons/AppIcon.vue';
import AdminLayout from '../../layouts/AdminLayout.vue';
import {
  bulkDeletePlaylistOwnedChannels,
  copyPlaylistOwnedChannel,
  createCatalog,
  createCatalogRelation,
  createChannelOwnedStream,
  createPlaylistOwnedChannel,
  deleteCatalogRelation,
  deleteChannelOwnedStream,
  deletePlaylistOwnedChannel,
  getCatalog,
  listCatalog,
  listCatalogRelation,
  movePlaylistOwnedChannel,
  sendPlaylistChannelScreenshotNow,
  updateCatalog,
  updateCatalogRelation,
  type CatalogItem,
} from '../../services/api';

interface StreamEditForm {
  relationId: string;
  streamId: string;
  title: string;
  priority: string;
  enabled: boolean;
  streamType: string;
  directUrl: string;
  providerId: string;
  streamKey: string;
  userAgent: string;
}

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
const screenshotModalOpen = ref(false);
const editChannelModalOpen = ref(false);
const editChannelSaving = ref(false);
const editNewStreamOpen = ref(false);
const screenshotSending = ref(false);
const movingChannelId = ref('');
const moveTargetPlaylistId = ref('');
const copyingChannelIds = ref<string[]>([]);
const copyTargetPlaylistId = ref('');
const screenshotChannelId = ref('');
const screenshotChannelTitle = ref('');
const screenshotError = ref('');
const screenshotNotice = ref('');
const editChannelId = ref('');
const editChannelError = ref('');
let screenshotNoticeTimer: number | undefined;
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
const editChannelForm = reactive({
  title: '',
  description: '',
  defaultDelaySeconds: '',
  defaultScale: '',
  enabled: true,
  timezonePresetIds: [] as string[],
});
const editStreamForms = ref<StreamEditForm[]>([]);
const editNewStreamForm = reactive({
  title: '',
  priority: '0',
  streamType: 'direct',
  directUrl: '',
  providerId: '',
  streamKey: '',
  userAgent: '',
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
onBeforeUnmount(() => {
  if (screenshotNoticeTimer) window.clearTimeout(screenshotNoticeTimer);
});

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
      listCatalog('providers', { limit: 200 }),
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

async function openEditChannelModal(channel: CatalogItem) {
  editChannelId.value = channel.id;
  editChannelError.value = '';
  editNewStreamOpen.value = false;
  resetNewStreamForm();
  editChannelModalOpen.value = true;

  try {
    const [channelResponse, streamsResponse, timezonesResponse] = await Promise.all([
      getCatalog('channels', channel.id),
      listCatalogRelation(`channels/${channel.id}/streams`),
      listCatalogRelation(`channels/${channel.id}/timezones`),
    ]);
    editChannelForm.title = String(channelResponse.title || '');
    editChannelForm.description = String(channelResponse.description || '');
    editChannelForm.defaultDelaySeconds =
      channelResponse.defaultDelaySeconds === null || channelResponse.defaultDelaySeconds === undefined
        ? ''
        : String(channelResponse.defaultDelaySeconds);
    editChannelForm.defaultScale = String(channelResponse.defaultScale || '');
    editChannelForm.enabled = channelResponse.enabled !== false;
    editChannelForm.timezonePresetIds = timezonesResponse.items.map((item) => timezoneOf(item).id);
    editStreamForms.value = streamsResponse.items.map(toStreamEditForm);
  } catch (err) {
    editChannelError.value = getErrorMessage(err);
  }
}

function closeEditChannelModal() {
  if (editChannelSaving.value) return;
  editChannelModalOpen.value = false;
  editChannelId.value = '';
  editChannelError.value = '';
  editStreamForms.value = [];
  editChannelForm.timezonePresetIds = [];
  editNewStreamOpen.value = false;
}

async function saveEditedChannel() {
  if (!editChannelId.value) return;
  editChannelSaving.value = true;
  editChannelError.value = '';

  try {
    await updateCatalog('channels', editChannelId.value, {
      title: editChannelForm.title,
      description: editChannelForm.description || null,
      defaultDelaySeconds: editChannelForm.defaultDelaySeconds === '' ? null : Number(editChannelForm.defaultDelaySeconds),
      defaultScale: editChannelForm.defaultScale || null,
      enabled: editChannelForm.enabled,
    });

    for (const stream of editStreamForms.value) {
      await updateCatalog('streams', stream.streamId, {
        title: stream.title,
        priority: Number(stream.priority || 0),
        enabled: stream.enabled,
        userAgent: stream.userAgent || null,
        ...streamPayload(stream),
      });
      await updateCatalogRelation(`channels/${editChannelId.value}/streams`, stream.relationId, {
        priority: Number(stream.priority || 0),
        enabled: stream.enabled,
      });
    }

    if (editNewStreamOpen.value) {
      await createChannelOwnedStream(editChannelId.value, {
        ...editNewStreamForm,
        priority: Number(editNewStreamForm.priority || 0),
      });
    }

    await syncEditedTimezones();
    closeEditChannelModal();
    await loadAll();
  } catch (err) {
    editChannelError.value = getErrorMessage(err);
  } finally {
    editChannelSaving.value = false;
  }
}

async function syncEditedTimezones() {
  const relations = await listCatalogRelation(`channels/${editChannelId.value}/timezones`);
  const existing = new Map(relations.items.map((item) => [timezoneOf(item).id, item.id]));
  const selected = new Set(editChannelForm.timezonePresetIds);

  for (const [timezonePresetId, relationId] of existing) {
    if (!selected.has(timezonePresetId)) {
      await deleteCatalogRelation(`channels/${editChannelId.value}/timezones`, relationId);
    }
  }

  for (const timezonePresetId of selected) {
    if (!existing.has(timezonePresetId)) {
      await createCatalogRelation(`channels/${editChannelId.value}/timezones`, {
        timezonePresetId,
        priority: editChannelForm.timezonePresetIds.indexOf(timezonePresetId),
      });
    }
  }
}

async function deleteEditedStream(stream: StreamEditForm) {
  if (!window.confirm('Удалить поток?')) return;
  await deleteChannelOwnedStream(editChannelId.value, stream.streamId);
  editStreamForms.value = editStreamForms.value.filter((item) => item.streamId !== stream.streamId);
}

function toStreamEditForm(link: CatalogItem): StreamEditForm {
  const stream = streamOf(link);
  return {
    relationId: link.id,
    streamId: stream.id,
    title: String(stream.title || ''),
    priority: String(link.priority ?? stream.priority ?? 0),
    enabled: link.enabled !== false && stream.enabled !== false,
    streamType: stream.providerId || stream.provider ? 'provider' : 'direct',
    directUrl: String(stream.directUrl || ''),
    providerId: String(stream.providerId || (stream.provider as CatalogItem | undefined)?.id || ''),
    streamKey: String(stream.streamKey || ''),
    userAgent: String(stream.userAgent || ''),
  };
}

function streamPayload(stream: StreamEditForm | typeof editNewStreamForm) {
  if (stream.streamType === 'provider') {
    return {
      providerId: stream.providerId,
      streamKey: stream.streamKey,
      directUrl: null,
    };
  }

  return {
    providerId: null,
    streamKey: null,
    directUrl: stream.directUrl,
  };
}

function resetNewStreamForm() {
  Object.assign(editNewStreamForm, {
    title: '',
    priority: '0',
    streamType: 'direct',
    directUrl: '',
    providerId: '',
    streamKey: '',
    userAgent: '',
  });
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

function openScreenshotModal(channel: CatalogItem) {
  screenshotChannelId.value = channel.id;
  screenshotChannelTitle.value = displayTitle(channel);
  screenshotError.value = '';
  screenshotModalOpen.value = true;
}

function closeScreenshotModal() {
  if (screenshotSending.value) return;
  screenshotModalOpen.value = false;
  screenshotChannelId.value = '';
  screenshotChannelTitle.value = '';
  screenshotError.value = '';
}

async function sendScreenshotNow() {
  if (!screenshotChannelId.value) return;
  screenshotSending.value = true;
  screenshotError.value = '';

  try {
    const result = await sendPlaylistChannelScreenshotNow(playlistId, screenshotChannelId.value);
    if (!result.ok) {
      screenshotError.value = result.errorMessage || 'Не удалось отправить скриншот';
      return;
    }
    closeScreenshotModal();
    showScreenshotNotice(result.messageId ? `Скриншот отправлен, message_id=${result.messageId}` : 'Скриншот отправлен');
  } catch (err) {
    screenshotError.value = getErrorMessage(err);
  } finally {
    screenshotSending.value = false;
  }
}

function showScreenshotNotice(message: string) {
  screenshotNotice.value = message;
  if (screenshotNoticeTimer) window.clearTimeout(screenshotNoticeTimer);
  screenshotNoticeTimer = window.setTimeout(() => {
    screenshotNotice.value = '';
  }, 3500);
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

function toggleEditTimezone(id: string, checked: boolean) {
  if (checked && !editChannelForm.timezonePresetIds.includes(id)) editChannelForm.timezonePresetIds.push(id);
  if (!checked) editChannelForm.timezonePresetIds = editChannelForm.timezonePresetIds.filter((item) => item !== id);
}

function channelOf(relation: CatalogItem) {
  return relation.channel as CatalogItem;
}

function streamOf(link: CatalogItem) {
  return link.stream as CatalogItem;
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
