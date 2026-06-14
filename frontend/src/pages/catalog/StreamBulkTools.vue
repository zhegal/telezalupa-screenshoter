<template>
  <section class="panel wide-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Stream Bulk Tools</p>
        <h2>Bulk Operations</h2>
      </div>
      <span class="pill level-info">{{ selectedIds.length }} выбрано</span>
    </div>

    <div class="filter-row">
      <button class="ghost-button control-button" type="button" @click="emit('selectVisible')">
        Select all visible
      </button>
      <button class="ghost-button control-button" type="button" @click="emit('clearSelection')">
        Clear selection
      </button>
      <select v-model="providerId" class="filter-input compact">
        <option value="">Provider</option>
        <option v-for="provider in providers" :key="provider.id" :value="provider.id">
          {{ displayTitle(provider) }}
        </option>
      </select>
      <button class="ghost-button control-button" type="button" :disabled="!canRun" @click="assignProvider">
        Assign Provider
      </button>
      <button class="ghost-button control-button" type="button" :disabled="selectedIds.length === 0" @click="setEnabled(true)">
        Enable
      </button>
      <button class="ghost-button control-button danger" type="button" :disabled="selectedIds.length === 0" @click="setEnabled(false)">
        Disable
      </button>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="stats" class="bulk-stats">{{ formatStats(stats) }}</p>

    <div class="bulk-transform">
      <h3>Transform URLs</h3>
      <p class="catalog-warning">
        Preview не сохраняет данные. Apply изменит только валидные записи: directUrl станет null,
        providerId будет выбранным Provider, streamKey будет вычислен из prefix/suffix.
      </p>

      <div class="filter-row">
        <input v-model="prefixToStrip" class="filter-input" type="text" placeholder="Prefix to strip" />
        <input v-model="suffixToStrip" class="filter-input" type="text" placeholder="Suffix to strip" />
        <button class="action-button" type="button" :disabled="!canRun" @click="preview">
          Preview
        </button>
        <button
          class="ghost-button control-button"
          type="button"
          :disabled="previewItems.length === 0 || validPreviewCount === 0"
          @click="apply"
        >
          Apply
        </button>
      </div>

      <div v-if="previewItems.length > 0" class="table-wrap">
        <table class="runtime-table">
          <thead>
            <tr>
              <th>OLD</th>
              <th>NEW</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in previewItems" :key="item.streamId">
              <td class="truncate">{{ item.directUrl || '—' }}</td>
              <td>
                <strong>provider = {{ providerTitle }}</strong>
                <small>streamKey = {{ item.streamKey || '—' }}</small>
              </td>
              <td>
                <span class="pill" :class="item.valid ? 'level-info' : 'level-error'">
                  {{ item.valid ? 'valid' : item.error || 'invalid' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  applyStreamTransform,
  bulkAssignStreamProvider,
  bulkSetStreamsEnabled,
  previewStreamTransform,
  type BulkOperationStats,
  type CatalogItem,
  type StreamTransformPreviewItem,
} from '../../services/api';

const props = defineProps<{
  streams: CatalogItem[];
  providers: CatalogItem[];
  selectedIds: string[];
}>();

const emit = defineEmits<{
  selectVisible: [];
  clearSelection: [];
  changed: [];
}>();

const providerId = ref('');
const prefixToStrip = ref('');
const suffixToStrip = ref('');
const error = ref<string | null>(null);
const stats = ref<BulkOperationStats | null>(null);
const previewItems = ref<StreamTransformPreviewItem[]>([]);

const canRun = computed(() => props.selectedIds.length > 0 && providerId.value.length > 0);
const validPreviewCount = computed(() => previewItems.value.filter((item) => item.valid).length);
const providerTitle = computed(() => displayTitle(props.providers.find((item) => item.id === providerId.value) || { id: providerId.value }));

async function assignProvider() {
  if (!window.confirm(`Назначить Provider для ${props.selectedIds.length} Streams?`)) {
    return;
  }

  await run(async () => bulkAssignStreamProvider(props.selectedIds, providerId.value), true);
}

async function setEnabled(enabled: boolean) {
  if (!window.confirm(`${enabled ? 'Enable' : 'Disable'} ${props.selectedIds.length} Streams?`)) {
    return;
  }

  await run(async () => bulkSetStreamsEnabled(props.selectedIds, enabled), true);
}

async function preview() {
  error.value = null;
  stats.value = null;

  try {
    previewItems.value = await previewStreamTransform(transformPayload());
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

async function apply() {
  if (!window.confirm(`Apply transform для ${validPreviewCount.value} валидных Streams?`)) {
    return;
  }

  await run(async () => applyStreamTransform(transformPayload()), true);
  previewItems.value = [];
}

async function run(action: () => Promise<BulkOperationStats>, changed: boolean) {
  error.value = null;

  try {
    stats.value = await action();
    if (changed) {
      emit('changed');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

function transformPayload() {
  return {
    streamIds: props.selectedIds,
    providerId: providerId.value,
    prefixToStrip: prefixToStrip.value,
    suffixToStrip: suffixToStrip.value,
  };
}

function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.id);
}

function formatStats(value: BulkOperationStats) {
  return `requested: ${value.requested}, updated: ${value.updated ?? 0}, skipped: ${value.skipped}, failed: ${value.failed}`;
}
</script>
