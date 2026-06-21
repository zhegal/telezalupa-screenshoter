<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">JSON Import Wizard</p>
          <h2>Импорт JSON в Database Catalog</h2>
        </div>
        <span class="pill level-warn">Worker still uses data/playlists.json</span>
      </div>

      <p class="catalog-warning">
        Импорт всегда проходит через preview. Он наполняет PostgreSQL catalog, но не переключает worker на БД.
      </p>

      <div class="catalog-tabs">
        <button
          v-for="item in steps"
          :key="item.id"
          class="ghost-button control-button"
          :class="{ active: step === item.id }"
          type="button"
          @click="step = item.id"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section v-if="step === 'source'" class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 1</p>
          <h2>Source</h2>
        </div>
      </div>

      <div class="catalog-form import-form">
        <label>
          <span>Источник</span>
          <select v-model="payload.sourceType">
            <option value="paste">Paste JSON</option>
            <option value="existingSource">Import from data/playlists.json source</option>
          </select>
        </label>

        <label v-if="payload.sourceType === 'paste'">
          <span>JSON</span>
          <textarea v-model="payload.json" class="large-textarea" placeholder='[{"title":"...","url":"..."}]' />
        </label>

        <label v-else>
          <span>Source URL</span>
          <select v-model="payload.sourceUrl">
            <option value="">Выберите URL</option>
            <option v-for="source in sources" :key="source" :value="source">{{ source }}</option>
          </select>
        </label>

        <button class="action-button" type="button" @click="step = 'playlist'">Далее</button>
      </div>
    </section>

    <section v-if="step === 'playlist'" class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 2</p>
          <h2>Playlist</h2>
        </div>
      </div>

      <div class="catalog-form import-form">
        <label>
          <span>Target mode</span>
          <select v-model="payload.targetMode">
            <option value="newPlaylist">Create new Playlist</option>
            <option value="existingPlaylist">Use existing Playlist</option>
          </select>
        </label>

        <label v-if="payload.targetMode === 'newPlaylist'">
          <span>Playlist title</span>
          <input v-model="payload.playlistTitle" type="text" />
        </label>

        <label v-else>
          <span>Playlist</span>
          <select v-model="payload.playlistId">
            <option value="">Выберите Playlist</option>
            <option v-for="playlist in playlists" :key="playlist.id" :value="playlist.id">
              {{ displayTitle(playlist) }}
            </option>
          </select>
        </label>

        <label class="toggle-line">
          <input v-model="payload.skipExactDuplicates" type="checkbox" />
          <span>Skip exact duplicates inside selected Playlist</span>
        </label>

        <button class="action-button" type="button" :disabled="loading" @click="buildPreview">
          Normalize & Preview
        </button>
      </div>
    </section>

    <section v-if="step === 'preview'" class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 3</p>
          <h2>Preview</h2>
        </div>
        <button class="action-button" type="button" :disabled="!preview || loading" @click="applyImport">
          Apply
        </button>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <dl v-if="preview" class="meta-grid metrics-grid">
        <div v-for="item in summaryItems" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>

      <div v-if="preview" class="table-wrap">
        <table class="runtime-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Original URL</th>
              <th>Mode</th>
              <th>Provider</th>
              <th>Timezones</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in preview.rows" :key="row.rowId">
              <td>
                <strong>{{ row.title }}</strong>
                <small>{{ row.description || '—' }}</small>
              </td>
              <td class="url-cell">{{ row.originalUrl }}</td>
              <td>{{ row.importMode }}</td>
              <td>
                <select
                  v-if="row.providerCandidates.length > 0"
                  :value="selectedProviders[row.rowId] ?? row.selectedProviderId ?? ''"
                  @change="selectedProviders[row.rowId] = ($event.target as HTMLSelectElement).value || null"
                >
                  <option value="">Direct URL</option>
                  <option
                    v-for="candidate in row.providerCandidates"
                    :key="candidate.providerId"
                    :value="candidate.providerId"
                  >
                    {{ candidate.title }} / {{ candidate.streamKey }}
                  </option>
                </select>
                <span v-else>Direct URL</span>
              </td>
              <td>
                <span v-for="timezone in row.timezones" :key="`${row.rowId}-${timezone.timezone}-${timezone.label}`" class="pill level-info import-pill">
                  {{ timezone.timezone }} / {{ timezone.label }} / {{ timezone.existing ? 'reuse' : 'create' }}
                </span>
              </td>
              <td>
                <span class="pill" :class="row.valid ? 'level-info' : 'level-error'">
                  {{ row.valid ? 'valid' : row.errors.join(', ') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="step === 'result'" class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 4</p>
          <h2>Apply result</h2>
        </div>
      </div>

      <dl v-if="result" class="meta-grid metrics-grid">
        <div v-for="item in resultItems" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>

      <div class="control-row">
        <RouterLink class="ghost-button control-button" to="/catalog">Open Catalog</RouterLink>
        <RouterLink class="ghost-button control-button" to="/catalog">Open Playlist</RouterLink>
        <RouterLink class="ghost-button control-button" to="/catalog">Open Channels</RouterLink>
        <RouterLink class="ghost-button control-button" to="/catalog">Open Streams</RouterLink>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AdminLayout from '../../layouts/AdminLayout.vue';
import {
  applyCatalogImport,
  getImportSources,
  listCatalog,
  previewCatalogImport,
  type CatalogItem,
  type ImportApplyResult,
  type ImportPreviewResponse,
  type ImportWizardPayload,
} from '../../services/api';

type Step = 'source' | 'playlist' | 'preview' | 'result';

const steps: { id: Step; label: string }[] = [
  { id: 'source', label: '1. Source' },
  { id: 'playlist', label: '2. Playlist' },
  { id: 'preview', label: '3. Preview' },
  { id: 'result', label: '4. Apply result' },
];

const step = ref<Step>('source');
const sources = ref<string[]>([]);
const playlists = ref<CatalogItem[]>([]);
const preview = ref<ImportPreviewResponse | null>(null);
const result = ref<ImportApplyResult | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedProviders = reactive<Record<string, string | null>>({});
const payload = reactive<ImportWizardPayload>({
  sourceType: 'paste',
  json: '',
  sourceUrl: '',
  targetMode: 'newPlaylist',
  playlistId: '',
  playlistTitle: '',
  skipExactDuplicates: false,
});

const summaryItems = computed(() => {
  const summary = preview.value?.summary;

  if (!summary) return [];

  return [
    { label: 'Rows', value: summary.totalRows },
    { label: 'Valid', value: summary.validRows },
    { label: 'Invalid', value: summary.invalidRows },
    { label: 'Channels', value: summary.channelsToCreate },
    { label: 'Streams', value: summary.streamsToCreate },
    { label: 'Playlist links', value: summary.playlistLinksToCreate },
    { label: 'TZ create', value: summary.timezonePresetsToCreate },
    { label: 'TZ reuse', value: summary.timezonePresetsToReuse },
    { label: 'Provider suggestions', value: summary.providerSuggestionsCount },
    { label: 'Direct URLs', value: summary.directUrlStreamsCount },
    { label: 'Skipped duplicates', value: summary.skippedDuplicatesCount },
  ];
});

const resultItems = computed(() => {
  const value = result.value;

  if (!value) return [];

  return [
    { label: 'Playlist ID', value: value.playlistId || '—' },
    { label: 'Created Playlist', value: String(value.createdPlaylist) },
    { label: 'Channels', value: value.createdChannels },
    { label: 'Streams', value: value.createdStreams },
    { label: 'Playlist links', value: value.createdPlaylistLinks },
    { label: 'Channel-stream links', value: value.createdChannelStreamLinks },
    { label: 'Timezone create', value: value.createdTimezonePresets },
    { label: 'Timezone reuse', value: value.reusedTimezonePresets },
    { label: 'Skipped', value: value.skipped },
    { label: 'Failed', value: value.failed },
  ];
});

onMounted(async () => {
  const [sourceResponse, playlistResponse] = await Promise.all([
    getImportSources(),
    listCatalog('playlists', { limit: 200 }),
  ]);

  sources.value = sourceResponse.items;
  playlists.value = playlistResponse.items;
});

async function buildPreview() {
  loading.value = true;
  error.value = null;

  try {
    preview.value = await previewCatalogImport({ ...payload });
    for (const key of Object.keys(selectedProviders)) delete selectedProviders[key];
    for (const row of preview.value.rows) {
      selectedProviders[row.rowId] = row.selectedProviderId;
    }
    step.value = 'preview';
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function applyImport() {
  if (!preview.value || !window.confirm(`Apply import for ${preview.value.summary.validRows} valid rows?`)) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    result.value = await applyCatalogImport({
      ...payload,
      rows: preview.value.rows.map((row) => ({
        rowId: row.rowId,
        selectedProviderId: selectedProviders[row.rowId] ?? null,
      })),
    });
    step.value = 'result';
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.id);
}
</script>
