<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Channel</p>
          <h2>{{ channel?.title || 'Channel' }}</h2>
        </div>
        <RouterLink class="ghost-button control-button" to="/channels">Назад к поиску</RouterLink>
      </div>

      <div class="editor-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="ghost-button control-button"
          :class="{ active: activeTab === tab.id }"
          type="button"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>

    <section v-if="activeTab === 'basic'" class="panel wide-panel">
      <form class="catalog-form compact-editor" @submit.prevent="saveChannel">
        <label>
          Название
          <input v-model="channelForm.title" />
        </label>
        <label>
          Описание
          <textarea v-model="channelForm.description" />
        </label>
        <label>
          Default delay seconds
          <input v-model="channelForm.defaultDelaySeconds" type="number" />
        </label>
        <label>
          Default scale
          <input v-model="channelForm.defaultScale" placeholder="1280:720" />
        </label>
        <label class="toggle-line status-toggle">
          <input v-model="channelForm.enabled" type="checkbox" />
          <span>Активен</span>
        </label>
        <div class="modal-actions">
          <button class="action-button" type="submit" :disabled="loading">Сохранить</button>
        </div>
      </form>
    </section>

    <section v-if="activeTab === 'streams'" class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Потоки канала</p>
          <h2>Потоки</h2>
        </div>
        <button class="action-button" type="button" @click="openStreamModal">Добавить поток</button>
      </div>

      <div class="table-wrap">
        <table class="runtime-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Источник</th>
              <th>User-Agent</th>
              <th>Priority</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="link in streamRelations" :key="link.id">
              <td><strong>{{ displayTitle(streamOf(link)) }}</strong></td>
              <td class="wrap-cell">{{ streamSource(streamOf(link)) }}</td>
              <td class="wrap-cell">{{ streamOf(link).userAgent || '—' }}</td>
              <td>
                <input
                  class="inline-input"
                  type="number"
                  :value="link.priority ?? streamOf(link).priority ?? 0"
                  @change="updateStreamPriority(link, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>
                <span class="pill" :class="link.enabled === false || streamOf(link).enabled === false ? 'level-warn' : 'level-info'">
                  {{ link.enabled === false || streamOf(link).enabled === false ? 'disabled' : 'enabled' }}
                </span>
              </td>
              <td class="row-actions">
                <button class="ghost-button danger" type="button" @click="deleteStream(streamOf(link).id)">Удалить</button>
              </td>
            </tr>
            <tr v-if="streamRelations.length === 0">
              <td colspan="6" class="empty-cell">
                <div class="empty-state">
                  <span>Нет потоков</span>
                  <button class="ghost-button control-button" type="button" @click="openStreamModal">Добавить поток</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="activeTab === 'timezones'" class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Таймзоны канала</p>
          <h2>Таймзоны</h2>
        </div>
        <button class="action-button" type="button" :disabled="!timezoneId" @click="addTimezone">Добавить таймзону</button>
      </div>
      <p class="catalog-warning">Если таймзоны канала не заданы, будут использоваться таймзоны плейлиста.</p>
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
            <tr v-for="link in timezoneRelations" :key="link.id">
              <td>{{ displayTitle(timezoneOf(link)) }}</td>
              <td>
                <input
                  class="inline-input"
                  type="number"
                  :value="link.priority ?? 0"
                  @change="updateTimezonePriority(link, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td class="row-actions">
                <button class="ghost-button danger" type="button" @click="deleteTimezone(link.id)">Удалить</button>
              </td>
            </tr>
            <tr v-if="timezoneRelations.length === 0">
              <td colspan="3" class="empty-cell">Таймзоны канала не заданы</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="streamModalOpen" class="modal-backdrop" role="presentation" @click.self="closeStreamModal">
      <form class="catalog-form catalog-modal" @submit.prevent="createStream">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Channel stream</p>
            <h2>Добавить поток</h2>
          </div>
          <button class="ghost-button control-button" type="button" @click="closeStreamModal">Cancel</button>
        </div>

        <section class="form-section">
          <h3>Основное</h3>
          <div class="form-section-fields">
            <label>Название<input v-model="streamForm.title" /></label>
            <label>Priority<input v-model="streamForm.priority" type="number" /></label>
          </div>
        </section>

        <section class="form-section">
          <h3>Источник</h3>
          <div class="form-section-fields">
            <label class="toggle-line status-toggle">
              <input v-model="streamForm.streamType" type="radio" value="direct" />
              <span>Direct URL</span>
            </label>
            <label class="toggle-line status-toggle">
              <input v-model="streamForm.streamType" type="radio" value="provider" />
              <span>Provider + Stream Key</span>
            </label>
            <template v-if="streamForm.streamType === 'direct'">
              <label>URL<input v-model="streamForm.directUrl" /></label>
            </template>
            <template v-else>
              <label>
                Provider
                <select v-model="streamForm.providerId">
                  <option value="">Выберите Provider</option>
                  <option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ displayTitle(provider) }}</option>
                </select>
              </label>
              <label>Stream Key<input v-model="streamForm.streamKey" /></label>
            </template>
            <label>User-Agent<input v-model="streamForm.userAgent" /></label>
          </div>
        </section>

        <div class="modal-actions">
          <button class="ghost-button control-button" type="button" @click="closeStreamModal">Отмена</button>
          <button class="action-button" type="submit" :disabled="loading">Сохранить</button>
        </div>
      </form>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import AdminLayout from '../../layouts/AdminLayout.vue';
import {
  createCatalogRelation,
  createChannelOwnedStream,
  deleteCatalogRelation,
  deleteChannelOwnedStream,
  getCatalog,
  listCatalog,
  listCatalogRelation,
  updateCatalog,
  updateCatalogRelation,
  type CatalogItem,
} from '../../services/api';

const route = useRoute();
const channelId = String(route.params.id);
const tabs = [
  { id: 'basic', label: 'Основное' },
  { id: 'streams', label: 'Потоки' },
  { id: 'timezones', label: 'Таймзоны' },
] as const;

const activeTab = ref<(typeof tabs)[number]['id']>('streams');
const channel = ref<CatalogItem | null>(null);
const streamRelations = ref<CatalogItem[]>([]);
const timezoneRelations = ref<CatalogItem[]>([]);
const providers = ref<CatalogItem[]>([]);
const timezones = ref<CatalogItem[]>([]);
const loading = ref(false);
const error = ref('');
const streamModalOpen = ref(false);
const timezoneId = ref('');
const timezonePriority = ref('0');
const channelForm = reactive({
  title: '',
  description: '',
  defaultDelaySeconds: '',
  defaultScale: '',
  enabled: true,
});
const streamForm = reactive({
  title: '',
  priority: '0',
  streamType: 'direct',
  directUrl: '',
  providerId: '',
  streamKey: '',
  userAgent: '',
});

onMounted(() => void loadAll());

async function loadAll() {
  loading.value = true;
  error.value = '';

  try {
    const [channelResponse, streamsResponse, timezoneResponse, providerResponse, timezoneListResponse] = await Promise.all([
      getCatalog('channels', channelId),
      listCatalogRelation(`channels/${channelId}/streams`),
      listCatalogRelation(`channels/${channelId}/timezones`),
      listCatalog('providers', { limit: 200, enabled: 'true' }),
      listCatalog('timezones', { limit: 200 }),
    ]);
    channel.value = channelResponse;
    channelForm.title = String(channelResponse.title || '');
    channelForm.description = String(channelResponse.description || '');
    channelForm.defaultDelaySeconds =
      channelResponse.defaultDelaySeconds === null || channelResponse.defaultDelaySeconds === undefined
        ? ''
        : String(channelResponse.defaultDelaySeconds);
    channelForm.defaultScale = String(channelResponse.defaultScale || '');
    channelForm.enabled = channelResponse.enabled !== false;
    streamRelations.value = streamsResponse.items;
    timezoneRelations.value = timezoneResponse.items;
    providers.value = providerResponse.items;
    timezones.value = timezoneListResponse.items;
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function saveChannel() {
  await updateCatalog('channels', channelId, {
    title: channelForm.title,
    description: channelForm.description || null,
    defaultDelaySeconds: channelForm.defaultDelaySeconds === '' ? null : Number(channelForm.defaultDelaySeconds),
    defaultScale: channelForm.defaultScale || null,
    enabled: channelForm.enabled,
  });
  await loadAll();
}

function openStreamModal() {
  Object.assign(streamForm, {
    title: '',
    priority: '0',
    streamType: 'direct',
    directUrl: '',
    providerId: '',
    streamKey: '',
    userAgent: '',
  });
  streamModalOpen.value = true;
}

function closeStreamModal() {
  streamModalOpen.value = false;
}

async function createStream() {
  await createChannelOwnedStream(channelId, { ...streamForm, priority: Number(streamForm.priority || 0) });
  closeStreamModal();
  await loadAll();
}

async function updateStreamPriority(link: CatalogItem, priority: string) {
  await updateCatalogRelation(`channels/${channelId}/streams`, link.id, {
    priority: Number(priority || 0),
    enabled: link.enabled !== false,
  });
  await loadAll();
}

async function deleteStream(streamId: string) {
  if (!window.confirm('Удалить поток?')) return;
  await deleteChannelOwnedStream(channelId, streamId);
  await loadAll();
}

async function addTimezone() {
  if (!timezoneId.value) return;
  await createCatalogRelation(`channels/${channelId}/timezones`, {
    timezonePresetId: timezoneId.value,
    priority: Number(timezonePriority.value || 0),
  });
  timezoneId.value = '';
  timezonePriority.value = '0';
  await loadAll();
}

async function updateTimezonePriority(link: CatalogItem, priority: string) {
  await updateCatalogRelation(`channels/${channelId}/timezones`, link.id, {
    priority: Number(priority || 0),
  });
  await loadAll();
}

async function deleteTimezone(linkId: string) {
  await deleteCatalogRelation(`channels/${channelId}/timezones`, linkId);
  await loadAll();
}

function streamOf(link: CatalogItem) {
  return link.stream as CatalogItem;
}

function timezoneOf(link: CatalogItem) {
  return link.timezonePreset as CatalogItem;
}

function streamSource(stream: CatalogItem) {
  const provider = stream.provider as CatalogItem | undefined;
  if (provider) {
    return `${displayTitle(provider)} / ${stream.streamKey || '—'}`;
  }

  return String(stream.directUrl || '—');
}

function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.id);
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
</script>
