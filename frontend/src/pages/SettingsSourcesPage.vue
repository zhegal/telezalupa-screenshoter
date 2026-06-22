<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">/api/settings/sources/status</p>
          <h2>Sources</h2>
        </div>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="refresh">
          Обновить
        </button>
      </div>

      <dl class="meta-grid metrics-grid">
        <div>
          <dt>Current source</dt>
          <dd>
            <span class="pill level-info">{{ status?.activeChannelSource || '—' }}</span>
          </dd>
        </div>
        <div>
          <dt>JSON source</dt>
          <dd>{{ status?.json.sourceAvailable ? 'available' : 'unavailable' }}</dd>
        </div>
        <div>
          <dt>Database source</dt>
          <dd>{{ status?.database.sourceAvailable ? 'available' : 'unavailable' }}</dd>
        </div>
      </dl>

      <div class="source-actions">
        <button
          class="ghost-button"
          :class="{ active: status?.activeChannelSource === 'json' }"
          type="button"
          :disabled="actionLoading || !status?.json.sourceAvailable"
          @click="switchSource('json')"
        >
          Use JSON
        </button>
        <button
          class="ghost-button"
          :class="{ active: status?.activeChannelSource === 'database' }"
          type="button"
          :disabled="actionLoading"
          @click="switchSource('database')"
        >
          Use Database
        </button>
      </div>

      <p v-if="status && !status.json.sourceAvailable" class="catalog-warning">
        JSON source cannot be selected: {{ status.json.error || 'file is not valid' }}.
      </p>
      <p v-if="message" class="bulk-stats">{{ message }}</p>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>

    <div class="settings-source-grid">
      <section class="panel wide-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">data/playlists.json</p>
            <h2>JSON file</h2>
          </div>
          <div class="control-row">
            <button class="ghost-button control-button" type="button" :disabled="loading" @click="openJsonEditor">
              {{ jsonStatus.exists ? 'View/Edit' : 'Create/Edit' }}
            </button>
            <button class="ghost-button control-button danger" type="button" :disabled="actionLoading" @click="removeJsonFile">
              Delete
            </button>
          </div>
        </div>

        <dl class="meta-grid">
          <div>
            <dt>Exists</dt>
            <dd>{{ jsonFile?.status.exists ?? status?.json.exists ?? false }}</dd>
          </div>
          <div>
            <dt>Valid</dt>
            <dd>{{ jsonFile?.status.valid ?? status?.json.valid ?? false }}</dd>
          </div>
          <div>
            <dt>Playlist URLs</dt>
            <dd>{{ jsonFile?.status.sourceCount ?? status?.json.sourceCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>Path</dt>
            <dd class="truncate">{{ jsonFile?.status.path || status?.json.path || '—' }}</dd>
          </div>
        </dl>

        <p v-if="!jsonStatus.exists && !jsonEditMode" class="catalog-warning">
          JSON file is missing. Use Create/Edit to create or upload playlist URLs.
        </p>

        <form v-if="jsonEditMode" class="catalog-form source-json-form" @submit.prevent="saveJsonFile">
          <label>
            Content
            <textarea v-model="jsonContent" class="large-textarea" spellcheck="false" />
          </label>
          <div class="modal-actions">
            <button class="ghost-button control-button" type="button" :disabled="actionLoading" @click="cancelJsonEdit">
              Cancel
            </button>
            <button class="action-button" type="submit" :disabled="actionLoading">
              Save JSON file
            </button>
          </div>
        </form>
      </section>

      <section class="panel wide-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">PostgreSQL catalog</p>
            <h2>Database source</h2>
          </div>
          <span class="pill" :class="status?.activeChannelSource === 'database' ? 'level-info' : 'level-warn'">
            {{ status?.activeChannelSource === 'database' ? 'active' : 'available' }}
          </span>
        </div>

        <dl class="meta-grid">
          <div>
            <dt>Providers</dt>
            <dd>{{ status?.database.providerCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>Streams</dt>
            <dd>{{ status?.database.streamCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>Channels</dt>
            <dd>{{ status?.database.channelCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>Playlists</dt>
            <dd>{{ status?.database.playlistCount ?? 0 }}</dd>
          </div>
        </dl>

        <p class="catalog-warning">
          Database source uses enabled playlists, channels, streams, and providers from PostgreSQL. Main playlist
          and channel editing is available from the Playlists section.
        </p>
      </section>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import {
  deleteJsonSourceFile,
  getJsonSourceFile,
  getSourceSettingsStatus,
  saveJsonSourceFile,
  setActiveSource,
  type ChannelSource,
  type JsonFileResponse,
  type SourceSettingsStatus,
} from '../services/api';

const status = ref<SourceSettingsStatus | null>(null);
const jsonFile = ref<JsonFileResponse | null>(null);
const jsonContent = ref('[\n]\n');
const savedJsonContent = ref('[\n]\n');
const jsonEditMode = ref(false);
const loading = ref(false);
const actionLoading = ref(false);
const message = ref('');
const error = ref('');

const jsonStatus = computed(() => jsonFile.value?.status || status.value?.json || {
  exists: false,
  valid: false,
  sourceAvailable: false,
  sourceCount: 0,
  path: 'data/playlists.json',
  error: null,
});

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;
  error.value = '';

  try {
    status.value = await getSourceSettingsStatus();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function openJsonEditor() {
  loading.value = true;
  error.value = '';
  message.value = '';

  try {
    jsonFile.value = await getJsonSourceFile();
    jsonContent.value = jsonFile.value.content || '[\n]\n';
    savedJsonContent.value = jsonContent.value;
    jsonEditMode.value = true;
    if (status.value) {
      status.value = {
        ...status.value,
        json: jsonFile.value.status,
      };
    } else {
      await refresh();
    }
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

function cancelJsonEdit() {
  jsonContent.value = savedJsonContent.value;
  jsonEditMode.value = false;
  error.value = '';
}

async function switchSource(source: ChannelSource) {
  actionLoading.value = true;
  error.value = '';
  message.value = '';

  try {
    const response = await setActiveSource(source);
    status.value = response.status;
    message.value = `Active source switched to ${source}. Worker restarted.`;
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    actionLoading.value = false;
  }
}

async function saveJsonFile() {
  actionLoading.value = true;
  error.value = '';
  message.value = '';

  try {
    const response = await saveJsonSourceFile(jsonContent.value);
    jsonFile.value = { status: response.status, content: null };
    const latest = await getJsonSourceFile();
    jsonFile.value = latest;
    jsonContent.value = latest.content || '[\n]\n';
    savedJsonContent.value = jsonContent.value;
    jsonEditMode.value = false;
    await refresh();
    message.value = response.backupPath
      ? `JSON file saved. Backup created: ${response.backupPath}`
      : 'JSON file saved.';
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    actionLoading.value = false;
  }
}

async function removeJsonFile() {
  if (!window.confirm('Delete data/playlists.json? A timestamped backup will be created if the file exists.')) {
    return;
  }

  actionLoading.value = true;
  error.value = '';
  message.value = '';

  try {
    const response = await deleteJsonSourceFile();
    jsonFile.value = { status: response.status, content: null };
    jsonContent.value = '[\n]\n';
    savedJsonContent.value = '[\n]\n';
    jsonEditMode.value = false;
    await refresh();
    message.value = response.backupPath
      ? `JSON file deleted. Backup created: ${response.backupPath}`
      : 'JSON file deleted.';
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    actionLoading.value = false;
  }
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
</script>
