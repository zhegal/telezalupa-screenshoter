<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Database references</p>
          <h2>Справочники</h2>
        </div>
        <span class="pill" :class="activeSource === 'database' ? 'level-info' : 'level-warn'">
          Active source: {{ activeSourceLabel }}
        </span>
      </div>

      <p class="catalog-warning">
        {{ catalogSourceDescription }}
      </p>
      <div class="catalog-subnav">
        <div class="catalog-subnav-group">
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
        <div class="catalog-subnav-group">
          <RouterLink class="ghost-button control-button" to="/catalog/import">
            JSON Import Wizard
          </RouterLink>
        </div>
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
        <input
          v-model="search"
          class="filter-input"
          type="search"
          placeholder="Поиск"
          @keydown.enter="applyFilters"
        />
        <select v-model="enabledFilter" class="filter-input compact" @change="applyFilters">
          <option value="">Все</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
        <button
          class="ghost-button control-button"
          type="button"
          :disabled="loading"
          @click="applyFilters"
        >
          Обновить
        </button>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="catalog-layout">
        <div class="table-wrap catalog-list">
          <table class="runtime-table">
            <thead>
              <tr>
                <th v-if="activeEntity === 'streams'" class="select-column">Bulk</th>
                <th>Title</th>
                <th>Enabled</th>
                <th>Details</th>
                <th v-if="activeEntity !== 'streams'">Relations</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in items"
                :key="item.id"
                :class="{ selected: selected?.id === item.id }"
              >
                <td v-if="activeEntity === 'streams'" class="select-column">
                  <input
                    :checked="selectedStreamIds.has(item.id)"
                    type="checkbox"
                    @change="
                      toggleStreamSelection(item.id, ($event.target as HTMLInputElement).checked)
                    "
                  />
                </td>
                <td>
                  <strong>{{ displayTitle(item) }}</strong>
                </td>
                <td>
                  <span class="pill" :class="item.enabled === false ? 'level-warn' : 'level-info'">
                    {{ item.enabled === false ? 'disabled' : 'enabled' }}
                  </span>
                </td>
                <td class="details-cell">{{ detailText(item) }}</td>
                <td v-if="activeEntity !== 'streams'">
                  <span class="muted">{{ summaryText(item) }}</span>
                </td>
                <td class="row-actions">
                  <div class="row-actions__inner">
                    <button class="ghost-button" type="button" @click="startEdit(item)">
                      Edit
                    </button>
                    <button class="ghost-button danger" type="button" @click="removeItem(item)">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td :colspan="activeEntity === 'streams' ? 5 : 5" class="empty-cell">
                  <div class="empty-state">
                    <span>Нет записей</span>
                    <button class="ghost-button control-button" type="button" @click="startCreate">
                      Создать
                    </button>
                  </div>
                </td>
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

      </div>
    </section>

    <div v-if="formVisible" class="modal-backdrop" role="presentation" @click.self="hideForm">
      <form class="catalog-form catalog-modal" role="dialog" aria-modal="true" @submit.prevent="saveForm">
          <div class="panel-header">
            <div>
              <p class="eyebrow">{{ currentConfig.label }}</p>
              <h2>{{ modalTitle }}</h2>
            </div>
            <button class="ghost-button control-button" type="button" @click="hideForm">
              Cancel
            </button>
          </div>

          <div v-if="isTabbedEditor" class="editor-tabs">
            <button
              v-for="tab in editorTabs"
              :key="tab"
              class="ghost-button control-button"
              :class="{ active: editorTab === tab }"
              type="button"
              @click="editorTab = tab"
            >
              {{ tabLabel(tab) }}
            </button>
          </div>

          <div v-if="editorTab === 'basic'" class="editor-tab-panel">
            <section v-for="group in formGroups" :key="group.title" class="form-section">
              <h3>{{ group.title }}</h3>
              <p v-if="group.description" class="form-section-description">{{ group.description }}</p>
              <div class="form-section-fields">
                <template v-for="field in group.fields" :key="field.name">
                  <label v-if="field.type !== 'checkbox'">
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
                  </label>
                  <label v-else class="toggle-line status-toggle">
                    <input
                      :checked="Boolean(form[field.name])"
                      type="checkbox"
                      @change="form[field.name] = ($event.target as HTMLInputElement).checked"
                    />
                    <span>{{ checkboxLabel(field.name) }}</span>
                  </label>
                </template>
              </div>
            </section>
          </div>

          <div v-else-if="editorTab === 'relations'" class="editor-tab-panel">
            <div class="relation-summary">
              <span v-for="part in relationSummaryParts(selected)" :key="part" class="pill level-info">{{ part }}</span>
            </div>
            <RouterLink
              v-if="selected && activeEntity === 'channels'"
              class="action-button"
              :to="`/catalog/channels/${selected.id}`"
            >
              Открыть потоки
            </RouterLink>
            <RouterLink
              v-if="selected && activeEntity === 'playlists'"
              class="action-button"
              :to="`/catalog/playlists/${selected.id}`"
            >
              Открыть каналы
            </RouterLink>
          </div>

          <div v-else class="editor-tab-panel">
            <p v-if="activeEntity === 'channels'" class="catalog-warning">
              Если таймзоны канала не заданы, будут использоваться таймзоны плейлиста.
            </p>
            <p v-if="activeEntity === 'playlists'" class="catalog-warning">
              Используются как fallback для каналов без собственных таймзон.
            </p>
            <div class="relation-summary">
              <span v-for="part in timezoneSummaryParts(selected)" :key="part" class="pill level-info">{{ part }}</span>
            </div>
            <RouterLink
              v-if="selected && activeEntity === 'channels'"
              class="action-button"
              :to="`/catalog/channels/${selected.id}`"
            >
              Открыть таймзоны
            </RouterLink>
            <RouterLink
              v-if="selected && activeEntity === 'playlists'"
              class="action-button"
              :to="`/catalog/playlists/${selected.id}`"
            >
              Открыть таймзоны
            </RouterLink>
          </div>

          <div v-if="editorTab === 'basic'" class="modal-actions">
            <button class="ghost-button control-button" type="button" @click="hideForm">Отмена</button>
            <button class="action-button" type="submit" :disabled="saving">
              {{ saving ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
      </form>
    </div>

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
import { useRouter } from 'vue-router';
import AdminLayout from '../../layouts/AdminLayout.vue';
import PaginationControls from '../../components/PaginationControls.vue';
import {
  createCatalog,
  deleteCatalog,
  getSourceSettingsStatus,
  listCatalog,
  updateCatalog,
  type CatalogEntity,
  type CatalogItem,
  type SourceSettingsStatus,
} from '../../services/api';
import StreamBulkTools from './StreamBulkTools.vue';
import { entityConfigs } from './catalog-page.config';
import {
  checkboxLabel,
  detailText,
  displayTitle,
  groupFields,
  relationSummaryParts as getRelationSummaryParts,
  summaryText as getSummaryText,
  tabLabel as getTabLabel,
  timezoneSummaryParts as getTimezoneSummaryParts,
} from './catalog-page.helpers';

const activeEntity = ref<CatalogEntity>('providers');
const router = useRouter();
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
const formVisible = ref(false);
const form = reactive<Record<string, string | boolean>>({});
const selectedStreamIds = reactive(new Set<string>());
const sourceStatus = ref<SourceSettingsStatus | null>(null);
const total = ref(0);
const offset = ref(0);
const pageSize = ref(Number(localStorage.getItem('catalogPageSize') || 50));
const editorTab = ref<'basic' | 'relations' | 'timezones'>('basic');

const currentConfig = computed(
  () => entityConfigs.find((item) => item.entity === activeEntity.value) || entityConfigs[0],
);
const entitySingularLabel = computed(() => currentConfig.value.label.replace(/s$/, ''));
const modalTitle = computed(() =>
  editingId.value ? `Редактирование ${entitySingularLabel.value}` : `Новый ${entitySingularLabel.value}`,
);
const isTabbedEditor = computed(
  () => Boolean(editingId.value) && (activeEntity.value === 'channels' || activeEntity.value === 'playlists'),
);
const editorTabs = computed(() => {
  if (!isTabbedEditor.value) {
    return ['basic'] as const;
  }

  return ['basic', 'relations', 'timezones'] as const;
});
const formGroups = computed(() => groupFields(activeEntity.value, currentConfig.value.fields));
const activeSource = computed(() => sourceStatus.value?.activeChannelSource || 'json');
const activeSourceLabel = computed(() => (activeSource.value === 'database' ? 'Database' : 'JSON'));
const catalogSourceDescription = computed(() =>
  activeSource.value === 'database'
    ? 'Worker сейчас использует PostgreSQL. Здесь находятся вспомогательные справочники: провайдеры, таймзоны, Telegram и подписи.'
    : 'Worker сейчас использует JSON source. Справочники можно подготовить заранее; они станут активными после переключения источника на Database.',
);

onMounted(async () => {
  await Promise.all([loadSourceStatus(), loadItems(), loadRelationsAndOptions()]);
});

async function loadSourceStatus() {
  sourceStatus.value = await getSourceSettingsStatus();
}

async function selectEntity(entity: CatalogEntity) {
  activeEntity.value = entity;
  search.value = '';
  enabledFilter.value = '';
  offset.value = 0;
  selected.value = null;
  hideForm();
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
      limit: pageSize.value,
      offset: offset.value,
    });
    items.value = response.items;
    total.value = response.total;

    if (selected.value) {
      selected.value = items.value.find((item) => item.id === selected.value?.id) || null;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  offset.value = 0;
  await loadItems();
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
  editorTab.value = 'basic';
  resetForm();
  formVisible.value = true;
}

async function startEdit(item: CatalogItem) {
  if (activeEntity.value === 'playlists') {
    await router.push(`/catalog/playlists/${item.id}`);
    return;
  }

  if (activeEntity.value === 'channels') {
    await router.push(`/catalog/channels/${item.id}`);
    return;
  }

  selected.value = item;
  editingId.value = item.id;
  editorTab.value = 'basic';
  resetForm(item);
  formVisible.value = true;
}

function hideForm() {
  formVisible.value = false;
  editingId.value = null;
  selected.value = null;
  editorTab.value = 'basic';
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
    formVisible.value = false;
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
      form[field.name] =
        source?.[field.name] === null || source?.[field.name] === undefined
          ? ''
          : String(source?.[field.name] || '');
    }
  }
}

function validateForm() {
  if (
    activeEntity.value === 'providers' &&
    !String(form.urlTemplate || '').includes('{streamKey}')
  ) {
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
      payload[field.name] = value === '' ? 0 : Number(value);
    } else if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value);
    } else {
      payload[field.name] = typeof value === 'string' && value.trim() === '' ? null : value;
    }
  }

  return payload;
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

async function changePage(nextOffset: number) {
  offset.value = nextOffset;
  await loadItems();
}

async function changePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize;
  localStorage.setItem('catalogPageSize', String(nextPageSize));
  offset.value = 0;
  await loadItems();
}

function summaryText(item: CatalogItem) {
  return getSummaryText(activeEntity.value, item);
}

function relationSummaryParts(item: CatalogItem | null) {
  return getRelationSummaryParts(activeEntity.value, item);
}

function timezoneSummaryParts(item: CatalogItem | null) {
  return getTimezoneSummaryParts(activeEntity.value, item);
}

function tabLabel(tab: 'basic' | 'relations' | 'timezones') {
  return getTabLabel(activeEntity.value, tab);
}
</script>
