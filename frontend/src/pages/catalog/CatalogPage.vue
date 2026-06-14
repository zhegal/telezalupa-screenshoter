<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Database catalog</p>
          <h2>Каталог</h2>
        </div>
        <span class="pill level-warn">Worker currently uses data/playlists.json</span>
      </div>

      <p class="catalog-warning">
        Эти записи сохраняются в PostgreSQL для будущего перехода на database source. Текущий worker не
        мониторит созданные здесь каналы и продолжает использовать JSON/runtime источник.
      </p>

      <div class="catalog-tabs">
        <button
          v-for="item in entityConfigs"
          :key="item.entity"
          class="ghost-button control-button"
          :class="{ active: activeEntity === item.entity }"
          type="button"
          @click="selectEntity(item.entity)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">/api/catalog/{{ activeEntity }}</p>
          <h2>{{ currentConfig.label }}</h2>
        </div>
        <button class="action-button" type="button" @click="startCreate">Создать</button>
      </div>

      <div class="filter-row">
        <input v-model="search" class="filter-input" type="search" placeholder="Поиск" @keydown.enter="loadItems" />
        <select v-model="enabledFilter" class="filter-input compact" @change="loadItems">
          <option value="">Все</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="loadItems">
          Обновить
        </button>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="catalog-layout">
        <div class="table-wrap catalog-list">
          <table class="runtime-table">
            <thead>
              <tr>
                <th>Title</th>
                <th v-if="activeEntity === 'streams'">Bulk</th>
                <th>Enabled</th>
                <th>Details</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id" :class="{ selected: selected?.id === item.id }">
                <td>
                  <strong>{{ displayTitle(item) }}</strong>
                  <small>{{ item.id }}</small>
                </td>
                <td v-if="activeEntity === 'streams'">
                  <input
                    :checked="selectedStreamIds.has(item.id)"
                    type="checkbox"
                    @change="toggleStreamSelection(item.id, ($event.target as HTMLInputElement).checked)"
                  />
                </td>
                <td>
                  <span class="pill" :class="item.enabled === false ? 'level-warn' : 'level-info'">
                    {{ item.enabled === false ? 'disabled' : 'enabled' }}
                  </span>
                </td>
                <td class="truncate">{{ detailText(item) }}</td>
                <td class="row-actions">
                  <button class="ghost-button" type="button" @click="startEdit(item)">Edit</button>
                  <button class="ghost-button danger" type="button" @click="removeItem(item)">Delete</button>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="4" class="empty-cell">Нет записей</td>
              </tr>
            </tbody>
          </table>
        </div>

        <form class="catalog-form" @submit.prevent="saveForm">
          <div class="panel-header">
            <div>
              <p class="eyebrow">{{ editingId ? 'Edit' : 'Create' }}</p>
              <h2>{{ currentConfig.label }}</h2>
            </div>
          </div>

          <label v-for="field in currentConfig.fields" :key="field.name">
            <span>{{ field.label }}</span>
            <input
              v-if="field.type === 'text' || field.type === 'number'"
              :value="stringFormValue(field.name)"
              :type="field.type"
              :placeholder="field.placeholder || ''"
              @input="setStringFormValue(field.name, ($event.target as HTMLInputElement).value)"
            />
            <textarea
              v-else-if="field.type === 'textarea'"
              :value="stringFormValue(field.name)"
              :placeholder="field.placeholder || ''"
              @input="setStringFormValue(field.name, ($event.target as HTMLTextAreaElement).value)"
            />
            <select
              v-else-if="field.type === 'provider'"
              :value="stringFormValue(field.name)"
              @change="setStringFormValue(field.name, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Без Provider</option>
              <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                {{ displayTitle(provider) }}
              </option>
            </select>
            <label v-else class="toggle-line">
              <input
                :checked="Boolean(form[field.name])"
                type="checkbox"
                @change="form[field.name] = ($event.target as HTMLInputElement).checked"
              />
              <span>{{ form[field.name] ? 'Enabled' : 'Disabled' }}</span>
            </label>
          </label>

          <button class="action-button" type="submit" :disabled="saving">
            {{ saving ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </form>
      </div>
    </section>

    <CatalogRelations
      v-if="selected && activeEntity === 'channels'"
      owner-type="channel"
      :owner="selected"
      :streams="streams"
      :timezones="timezones"
      @changed="loadRelationsAndOptions"
    />

    <CatalogRelations
      v-if="selected && activeEntity === 'playlists'"
      owner-type="playlist"
      :owner="selected"
      :channels="channels"
      :timezones="timezones"
      @changed="loadRelationsAndOptions"
    />

    <BulkRelationManager
      v-if="selected && activeEntity === 'playlists'"
      owner-type="playlist"
      :owner="selected"
      :options="channels"
      @changed="loadRelationsAndOptions"
    />

    <BulkRelationManager
      v-if="selected && activeEntity === 'channels'"
      owner-type="channel"
      :owner="selected"
      :options="streams"
      @changed="loadRelationsAndOptions"
    />

    <StreamBulkTools
      v-if="activeEntity === 'streams'"
      :streams="items"
      :providers="providers"
      :selected-ids="Array.from(selectedStreamIds)"
      @select-visible="selectVisibleStreams"
      @clear-selection="clearStreamSelection"
      @changed="handleStreamBulkChanged"
    />
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AdminLayout from '../../layouts/AdminLayout.vue';
import {
  createCatalog,
  deleteCatalog,
  listCatalog,
  updateCatalog,
  type CatalogEntity,
  type CatalogItem,
} from '../../services/api';
import BulkRelationManager from './BulkRelationManager.vue';
import CatalogRelations from './CatalogRelations.vue';
import StreamBulkTools from './StreamBulkTools.vue';

type FieldType = 'text' | 'number' | 'textarea' | 'checkbox' | 'provider';

interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
}

interface EntityConfig {
  entity: CatalogEntity;
  label: string;
  fields: FieldConfig[];
}

const entityConfigs: EntityConfig[] = [
  {
    entity: 'providers',
    label: 'Providers',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'urlTemplate', label: 'URL template', type: 'text', placeholder: 'https://host/{streamKey}/playlist.m3u8' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'streams',
    label: 'Streams',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'providerId', label: 'Provider', type: 'provider' },
      { name: 'streamKey', label: 'Stream key', type: 'text' },
      { name: 'directUrl', label: 'Direct URL', type: 'text' },
      { name: 'userAgent', label: 'User-Agent', type: 'text' },
      { name: 'priority', label: 'Priority', type: 'number' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'channels',
    label: 'Channels',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'description', label: 'Описание', type: 'textarea' },
      { name: 'defaultDelaySeconds', label: 'Default delay seconds', type: 'number' },
      { name: 'defaultScale', label: 'Default scale', type: 'text', placeholder: '1280:720' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'playlists',
    label: 'Playlists',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'priority', label: 'Priority', type: 'number' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'timezones',
    label: 'Timezones',
    fields: [
      { name: 'timezone', label: 'Timezone', type: 'text', placeholder: 'Europe/Kyiv' },
      { name: 'label', label: 'Label', type: 'text', placeholder: 'Київ' },
      { name: 'priority', label: 'Priority', type: 'number' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'telegram-chats',
    label: 'Telegram Chats',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'chatId', label: 'Chat ID', type: 'text' },
      { name: 'isDefault', label: 'Default', type: 'checkbox' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
  {
    entity: 'caption-templates',
    label: 'Caption Templates',
    fields: [
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'template', label: 'Template', type: 'textarea' },
      { name: 'isDefault', label: 'Default', type: 'checkbox' },
      { name: 'enabled', label: 'Enabled', type: 'checkbox' },
    ],
  },
];

const activeEntity = ref<CatalogEntity>('providers');
const items = ref<CatalogItem[]>([]);
const selected = ref<CatalogItem | null>(null);
const providers = ref<CatalogItem[]>([]);
const streams = ref<CatalogItem[]>([]);
const channels = ref<CatalogItem[]>([]);
const timezones = ref<CatalogItem[]>([]);
const search = ref('');
const enabledFilter = ref('');
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const editingId = ref<string | null>(null);
const form = reactive<Record<string, string | boolean>>({});
const selectedStreamIds = reactive(new Set<string>());

const currentConfig = computed(() => entityConfigs.find((item) => item.entity === activeEntity.value) || entityConfigs[0]);

onMounted(async () => {
  await Promise.all([loadItems(), loadRelationsAndOptions()]);
});

async function selectEntity(entity: CatalogEntity) {
  activeEntity.value = entity;
  search.value = '';
  enabledFilter.value = '';
  selected.value = null;
  startCreate();
  clearStreamSelection();
  await loadItems();
}

async function loadItems() {
  loading.value = true;
  error.value = null;

  try {
    const response = await listCatalog(activeEntity.value, {
      search: search.value,
      enabled: enabledFilter.value,
      limit: 100,
    });
    items.value = response.items;

    if (selected.value) {
      selected.value = items.value.find((item) => item.id === selected.value?.id) || null;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function loadRelationsAndOptions() {
  const [providerResponse, streamResponse, channelResponse, timezoneResponse] = await Promise.all([
    listCatalog('providers', { limit: 200 }),
    listCatalog('streams', { limit: 200 }),
    listCatalog('channels', { limit: 200 }),
    listCatalog('timezones', { limit: 200 }),
  ]);

  providers.value = providerResponse.items;
  streams.value = streamResponse.items;
  channels.value = channelResponse.items;
  timezones.value = timezoneResponse.items;
}

function startCreate() {
  editingId.value = null;
  selected.value = null;
  resetForm();
}

function startEdit(item: CatalogItem) {
  selected.value = item;
  editingId.value = item.id;
  resetForm(item);
}

async function saveForm() {
  error.value = validateForm();

  if (error.value) {
    return;
  }

  saving.value = true;

  try {
    const payload = serializeForm();
    const saved = editingId.value
      ? await updateCatalog(activeEntity.value, editingId.value, payload)
      : await createCatalog(activeEntity.value, payload);

    selected.value = saved;
    editingId.value = saved.id;
    await Promise.all([loadItems(), loadRelationsAndOptions()]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    saving.value = false;
  }
}

async function removeItem(item: CatalogItem) {
  if (!window.confirm(`Удалить "${displayTitle(item)}"?`)) {
    return;
  }

  try {
    await deleteCatalog(activeEntity.value, item.id);
    if (selected.value?.id === item.id) {
      startCreate();
    }
    await loadItems();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

function resetForm(source: CatalogItem | null = null) {
  for (const key of Object.keys(form)) {
    delete form[key];
  }

  for (const field of currentConfig.value.fields) {
    if (field.type === 'checkbox') {
      form[field.name] = source ? Boolean(source[field.name]) : field.name === 'enabled';
    } else {
      form[field.name] = source?.[field.name] === null || source?.[field.name] === undefined ? '' : String(source?.[field.name] || '');
    }
  }
}

function validateForm() {
  if (activeEntity.value === 'providers' && !String(form.urlTemplate || '').includes('{streamKey}')) {
    return 'Provider.urlTemplate должен содержать {streamKey}';
  }

  if (activeEntity.value === 'streams') {
    const providerId = String(form.providerId || '').trim();
    const streamKey = String(form.streamKey || '').trim();
    const directUrl = String(form.directUrl || '').trim();

    if (providerId && !streamKey) {
      return 'Если выбран Provider, streamKey обязателен';
    }

    if (!providerId && !directUrl) {
      return 'Если Provider не выбран, directUrl обязателен';
    }
  }

  return null;
}

function serializeForm() {
  const payload: Record<string, unknown> = {};

  for (const field of currentConfig.value.fields) {
    const value = form[field.name];

    if (field.type === 'number') {
      payload[field.name] = value === '' ? null : Number(value);
    } else if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value);
    } else {
      payload[field.name] = typeof value === 'string' && value.trim() === '' ? null : value;
    }
  }

  return payload;
}

function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.chatId || item.id);
}

function stringFormValue(name: string) {
  const value = form[name];
  return typeof value === 'string' ? value : '';
}

function setStringFormValue(name: string, value: string) {
  form[name] = value;
}

function toggleStreamSelection(id: string, checked: boolean) {
  if (checked) {
    selectedStreamIds.add(id);
  } else {
    selectedStreamIds.delete(id);
  }
}

function selectVisibleStreams() {
  for (const item of items.value) {
    selectedStreamIds.add(item.id);
  }
}

function clearStreamSelection() {
  selectedStreamIds.clear();
}

async function handleStreamBulkChanged() {
  clearStreamSelection();
  await Promise.all([loadItems(), loadRelationsAndOptions()]);
}

function detailText(item: CatalogItem) {
  if ('urlTemplate' in item) return String(item.urlTemplate || '');
  if ('directUrl' in item) return String(item.directUrl || item.streamKey || '');
  if ('description' in item) return String(item.description || '');
  if ('timezone' in item) return `${item.timezone || ''} ${item.label || ''}`;
  if ('chatId' in item) return String(item.chatId || '');
  if ('template' in item) return String(item.template || '').slice(0, 120);
  return `priority: ${item.priority ?? 0}`;
}
</script>
