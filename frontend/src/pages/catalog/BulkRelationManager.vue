<template>
  <section class="panel wide-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Bulk Catalog Tools</p>
        <h2>{{ title }}</h2>
      </div>
      <span class="pill level-info">{{ selectedIds.size }} выбрано</span>
    </div>

    <p class="catalog-warning">
      Массовые операции требуют ручного выбора и подтверждения. JSON Import Wizard пока не реализован,
      worker всё ещё использует data/playlists.json.
    </p>

    <div class="filter-row">
      <input v-model="search" class="filter-input" type="search" placeholder="Поиск" />
      <button class="ghost-button control-button" type="button" @click="selectVisible">
        Select all visible
      </button>
      <button class="ghost-button control-button" type="button" @click="selectedIds.clear()">
        Clear selection
      </button>
      <button class="action-button" type="button" :disabled="selectedIds.size === 0 || loading" @click="attach">
        Bulk attach
      </button>
      <button class="ghost-button control-button danger" type="button" :disabled="selectedIds.size === 0 || loading" @click="detach">
        Bulk detach
      </button>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="stats" class="bulk-stats">{{ formatStats(stats) }}</p>

    <div class="bulk-list">
      <label v-for="item in visibleOptions" :key="item.id" class="bulk-option">
        <input
          :checked="selectedIds.has(item.id)"
          type="checkbox"
          @change="toggle(item.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>
          <strong>{{ displayTitle(item) }}</strong>
          <small>{{ item.id }}</small>
        </span>
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  bulkAttachChannelStreams,
  bulkAttachPlaylistChannels,
  bulkDetachChannelStreams,
  bulkDetachPlaylistChannels,
  type BulkOperationStats,
  type CatalogItem,
} from '../../services/api';

const props = defineProps<{
  ownerType: 'playlist' | 'channel';
  owner: CatalogItem;
  options: CatalogItem[];
}>();

const emit = defineEmits<{
  changed: [];
}>();

const selectedIds = reactive(new Set<string>());
const search = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const stats = ref<BulkOperationStats | null>(null);

const title = computed(() =>
  props.ownerType === 'playlist'
    ? `Manage Channels: ${displayTitle(props.owner)}`
    : `Manage Streams: ${displayTitle(props.owner)}`,
);

const visibleOptions = computed(() => {
  const query = search.value.trim().toLowerCase();

  return props.options.filter((item) => !query || displayTitle(item).toLowerCase().includes(query));
});

function toggle(id: string, checked: boolean) {
  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
}

function selectVisible() {
  for (const item of visibleOptions.value) {
    selectedIds.add(item.id);
  }
}

async function attach() {
  if (!window.confirm(`Привязать ${selectedIds.size} записей?`)) {
    return;
  }

  await runBulk('attach');
}

async function detach() {
  if (!window.confirm(`Отвязать ${selectedIds.size} записей?`)) {
    return;
  }

  await runBulk('detach');
}

async function runBulk(action: 'attach' | 'detach') {
  loading.value = true;
  error.value = null;

  try {
    const ids = Array.from(selectedIds);
    stats.value =
      props.ownerType === 'playlist'
        ? action === 'attach'
          ? await bulkAttachPlaylistChannels(props.owner.id, ids)
          : await bulkDetachPlaylistChannels(props.owner.id, ids)
        : action === 'attach'
          ? await bulkAttachChannelStreams(props.owner.id, ids)
          : await bulkDetachChannelStreams(props.owner.id, ids);
    emit('changed');
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.chatId || item.id);
}

function formatStats(value: BulkOperationStats) {
  return `requested: ${value.requested}, created: ${value.created ?? 0}, deleted: ${value.deleted ?? 0}, skipped: ${value.skipped}, failed: ${value.failed}`;
}
</script>
