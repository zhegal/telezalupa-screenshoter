<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Catalog management</p>
          <h2>{{ title }}</h2>
        </div>
        <RouterLink class="ghost-button control-button" to="/catalog">Назад в Catalog</RouterLink>
      </div>

      <p v-if="isTimezoneMode && ownerKind === 'channels'" class="catalog-warning">
        Если таймзоны канала не заданы, будут использоваться таймзоны плейлиста.
      </p>
      <p v-if="isTimezoneMode && ownerKind === 'playlists'" class="catalog-warning">
        Таймзоны плейлиста используются как fallback для каналов без собственных таймзон.
      </p>

      <div class="filter-row">
        <input v-model="search" class="filter-input" type="search" placeholder="Поиск" @keydown.enter="loadOptions" />
        <button class="ghost-button control-button" type="button" @click="loadOptions">Найти</button>
        <button class="ghost-button control-button" type="button" @click="selectVisible">Выбрать видимые</button>
        <button class="ghost-button control-button" type="button" @click="selectedIds.clear()">Очистить</button>
        <button class="action-button" type="button" :disabled="selectedIds.size === 0 || loading" @click="attachSelected">
          {{ addActionLabel }}
        </button>
        <button class="ghost-button control-button danger" type="button" :disabled="selectedIds.size === 0 || loading" @click="detachSelected">
          {{ deleteActionLabel }}
        </button>
        <span class="pill level-info">{{ selectedIds.size }} selected</span>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-if="message" class="bulk-stats">{{ message }}</p>

      <div class="relation-grid">
        <div class="relation-block">
          <h3>Доступные для добавления</h3>
          <div class="bulk-list">
            <label v-for="item in options" :key="item.id" class="bulk-option">
              <input
                :checked="selectedIds.has(item.id)"
                type="checkbox"
                @change="toggle(item.id, ($event.target as HTMLInputElement).checked)"
              />
              <span>
                <strong>{{ displayTitle(item) }}</strong>
                <small>{{ detailText(item) }}</small>
              </span>
            </label>
          </div>
          <PaginationControls
            :total="total"
            :offset="offset"
            :page-size="pageSize"
            @change-page="changePage"
            @change-page-size="changePageSize"
          />
        </div>

        <div class="relation-block">
          <h3>Текущие</h3>
          <div class="table-wrap">
            <table class="runtime-table compact-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Priority</th>
                  <th v-if="!isTimezoneMode">Enabled</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="relation in relations" :key="relation.id">
                  <td>
                    <strong>{{ relationTitle(relation) }}</strong>
                    <small>{{ relationTargetId(relation) }}</small>
                  </td>
                  <td>{{ relation.priority ?? 0 }}</td>
                  <td v-if="!isTimezoneMode">
                    <span class="pill" :class="relation.enabled === false ? 'level-warn' : 'level-info'">
                      {{ relation.enabled === false ? 'disabled' : 'enabled' }}
                    </span>
                  </td>
                </tr>
                <tr v-if="relations.length === 0">
                  <td :colspan="isTimezoneMode ? 2 : 3" class="empty-cell">Нет записей</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import AdminLayout from '../../layouts/AdminLayout.vue';
import PaginationControls from '../../components/PaginationControls.vue';
import {
  bulkAttachChannelStreams,
  bulkAttachPlaylistChannels,
  bulkDetachChannelStreams,
  bulkDetachPlaylistChannels,
  bulkDeletePlaylistOwnedChannels,
  createCatalogRelation,
  deleteCatalogRelation,
  deleteChannelOwnedStream,
  getCatalog,
  listCatalog,
  listCatalogRelation,
  type CatalogEntity,
  type CatalogItem,
} from '../../services/api';

const route = useRoute();
const owner = ref<CatalogItem | null>(null);
const options = ref<CatalogItem[]>([]);
const relations = ref<CatalogItem[]>([]);
const selectedIds = reactive(new Set<string>());
const search = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const message = ref('');
const total = ref(0);
const offset = ref(0);
const pageSize = ref(Number(localStorage.getItem('relationPageSize') || 50));

const ownerKind = computed(() => route.params.owner as 'channels' | 'playlists');
const relationKind = computed(() => route.params.relation as 'channels' | 'streams' | 'timezones');
const ownerEntity = computed<CatalogEntity>(() => ownerKind.value);
const optionEntity = computed<CatalogEntity>(() => (relationKind.value === 'timezones' ? 'timezones' : relationKind.value));
const isTimezoneMode = computed(() => relationKind.value === 'timezones');
const relationPath = computed(() => `${ownerKind.value}/${route.params.id}/${relationKind.value}`);
const title = computed(() => `${relationTitleLabel.value}: ${owner.value ? displayTitle(owner.value) : route.params.id}`);
const relationTitleLabel = computed(() => {
  if (relationKind.value === 'channels') return 'Каналы';
  if (relationKind.value === 'streams') return 'Потоки';
  return 'Таймзоны';
});
const addActionLabel = computed(() => {
  if (relationKind.value === 'channels') return 'Добавить канал';
  if (relationKind.value === 'streams') return 'Добавить поток';
  return 'Добавить таймзону';
});
const deleteActionLabel = computed(() => {
  if (relationKind.value === 'channels') return 'Удалить канал';
  if (relationKind.value === 'streams') return 'Удалить поток';
  return 'Удалить таймзону';
});

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;
  error.value = null;

  try {
    const [ownerResponse, relationResponse] = await Promise.all([
      getCatalog(ownerEntity.value, String(route.params.id)),
      listCatalogRelation(relationPath.value),
    ]);
    owner.value = ownerResponse;
    relations.value = relationResponse.items;
    await loadOptions();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  const response = await listCatalog(optionEntity.value, {
    search: search.value,
    limit: pageSize.value,
    offset: offset.value,
  });
  options.value = response.items;
  total.value = response.total;
}

function toggle(id: string, checked: boolean) {
  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
}

function selectVisible() {
  for (const item of options.value) {
    selectedIds.add(item.id);
  }
}

async function attachSelected() {
  await runRelationAction('attach');
}

async function detachSelected() {
  await runRelationAction('detach');
}

async function runRelationAction(action: 'attach' | 'detach') {
  loading.value = true;
  error.value = null;
  message.value = '';

  try {
    const ids = Array.from(selectedIds);

    if (ownerKind.value === 'playlists' && relationKind.value === 'channels') {
      const stats =
        action === 'attach'
          ? await bulkAttachPlaylistChannels(String(route.params.id), ids)
          : await bulkDeletePlaylistOwnedChannels(String(route.params.id), ids);
      message.value = formatStats(stats);
    } else if (ownerKind.value === 'channels' && relationKind.value === 'streams') {
      if (action === 'attach') {
        const stats = await bulkAttachChannelStreams(String(route.params.id), ids);
        message.value = formatStats(stats);
      } else {
        for (const id of ids) {
          await deleteChannelOwnedStream(String(route.params.id), id);
        }
        message.value = `deleted: ${ids.length}`;
      }
    } else if (action === 'attach') {
      for (const id of ids) {
        await createCatalogRelation(relationPath.value, { timezonePresetId: id });
      }
      message.value = `added: ${ids.length}`;
    } else {
      await detachTimezoneIds(ids);
      message.value = `removed: ${ids.length}`;
    }

    selectedIds.clear();
    await refresh();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function detachTimezoneIds(ids: string[]) {
  const relationIds = relations.value
    .filter((relation) => ids.includes(relationTargetId(relation)))
    .map((relation) => relation.id);

  for (const relationId of relationIds) {
    await deleteCatalogRelation(relationPath.value, relationId);
  }
}

async function changePage(nextOffset: number) {
  offset.value = nextOffset;
  await loadOptions();
}

async function changePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize;
  localStorage.setItem('relationPageSize', String(nextPageSize));
  offset.value = 0;
  await loadOptions();
}

function relationTitle(relation: CatalogItem) {
  const target = relationTarget(relation);
  return target ? displayTitle(target) : relation.id;
}

function relationTargetId(relation: CatalogItem) {
  const target = relationTarget(relation);
  return target?.id || relation.id;
}

function relationTarget(relation: CatalogItem) {
  if (relationKind.value === 'channels') return relation.channel as CatalogItem | undefined;
  if (relationKind.value === 'streams') return relation.stream as CatalogItem | undefined;
  return relation.timezonePreset as CatalogItem | undefined;
}

function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.chatId || item.id);
}

function detailText(item: CatalogItem) {
  return String(item.directUrl || item.streamKey || item.description || item.timezone || item.id);
}

function formatStats(value: { requested: number; created?: number; deleted?: number; skipped: number; failed: number }) {
  return `requested: ${value.requested}, created: ${value.created ?? 0}, deleted: ${value.deleted ?? 0}, skipped: ${value.skipped}, failed: ${value.failed}`;
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
</script>
