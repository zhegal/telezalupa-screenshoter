<template>
  <section class="panel wide-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Связи</p>
        <h2>{{ ownerType === 'channel' ? 'Channel relations' : 'Playlist relations' }}</h2>
      </div>
      <button class="ghost-button control-button" type="button" :disabled="loading" @click="loadRelations">
        Обновить
      </button>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div class="relation-grid">
      <div class="relation-block">
        <h3>{{ ownerType === 'channel' ? 'Streams' : 'Channels' }}</h3>
        <form class="relation-form" @submit.prevent="addPrimary">
          <select v-model="primaryId" class="filter-input">
            <option value="">Выберите запись</option>
            <option v-for="item in primaryOptions" :key="item.id" :value="item.id">
              {{ displayTitle(item) }}
            </option>
          </select>
          <input v-model="primaryPriority" class="filter-input compact" type="number" placeholder="Priority" />
          <button class="action-button" type="submit">Добавить</button>
        </form>

        <div class="table-wrap">
          <table class="runtime-table compact-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Priority</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="relation in primaryRelations" :key="relation.id">
                <td>{{ displayRelationTitle(relation, ownerType === 'channel' ? 'stream' : 'channel') }}</td>
                <td>
                  <input
                    class="inline-input"
                    type="number"
                    :value="relation.priority ?? 0"
                    @change="updatePrimary(relation, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <span class="pill" :class="relation.enabled === false ? 'level-warn' : 'level-info'">
                    {{ relation.enabled === false ? 'disabled' : 'enabled' }}
                  </span>
                </td>
                <td>
                  <button class="ghost-button danger" type="button" @click="deletePrimary(relation)">
                    Delete
                  </button>
                </td>
              </tr>
              <tr v-if="primaryRelations.length === 0">
                <td colspan="4" class="empty-cell">Нет связей</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="relation-block">
        <h3>Timezones</h3>
        <form class="relation-form" @submit.prevent="addTimezone">
          <select v-model="timezoneId" class="filter-input">
            <option value="">Выберите timezone</option>
            <option v-for="item in timezones" :key="item.id" :value="item.id">
              {{ displayTitle(item) }}
            </option>
          </select>
          <input v-model="timezonePriority" class="filter-input compact" type="number" placeholder="Priority" />
          <button class="action-button" type="submit">Добавить</button>
        </form>

        <div class="table-wrap">
          <table class="runtime-table compact-table">
            <thead>
              <tr>
                <th>Timezone</th>
                <th>Priority</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="relation in timezoneRelations" :key="relation.id">
                <td>{{ displayRelationTitle(relation, 'timezonePreset') }}</td>
                <td>
                  <input
                    class="inline-input"
                    type="number"
                    :value="relation.priority ?? 0"
                    @change="updateTimezone(relation, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <button class="ghost-button danger" type="button" @click="deleteTimezone(relation)">
                    Delete
                  </button>
                </td>
              </tr>
              <tr v-if="timezoneRelations.length === 0">
                <td colspan="3" class="empty-cell">Нет timezones</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  createCatalogRelation,
  deleteCatalogRelation,
  listCatalogRelation,
  updateCatalogRelation,
  type CatalogItem,
} from '../../services/api';

const props = defineProps<{
  ownerType: 'channel' | 'playlist';
  owner: CatalogItem;
  streams?: CatalogItem[];
  channels?: CatalogItem[];
  timezones: CatalogItem[];
}>();

const emit = defineEmits<{
  changed: [];
}>();

const primaryRelations = ref<CatalogItem[]>([]);
const timezoneRelations = ref<CatalogItem[]>([]);
const primaryId = ref('');
const primaryPriority = ref('0');
const timezoneId = ref('');
const timezonePriority = ref('0');
const loading = ref(false);
const error = ref<string | null>(null);

const primaryOptions = computed(() => (props.ownerType === 'channel' ? props.streams || [] : props.channels || []));
const primaryPath = computed(() =>
  props.ownerType === 'channel' ? `channels/${props.owner.id}/streams` : `playlists/${props.owner.id}/channels`,
);
const timezonePath = computed(() =>
  props.ownerType === 'channel' ? `channels/${props.owner.id}/timezones` : `playlists/${props.owner.id}/timezones`,
);

onMounted(() => {
  void loadRelations();
});

watch(
  () => props.owner.id,
  () => {
    void loadRelations();
  },
);

async function loadRelations() {
  loading.value = true;
  error.value = null;

  try {
    const [primary, timezones] = await Promise.all([
      listCatalogRelation(primaryPath.value),
      listCatalogRelation(timezonePath.value),
    ]);

    primaryRelations.value = primary.items;
    timezoneRelations.value = timezones.items;
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function addPrimary() {
  if (!primaryId.value) {
    return;
  }

  const idKey = props.ownerType === 'channel' ? 'streamId' : 'channelId';
  await createCatalogRelation(primaryPath.value, {
    [idKey]: primaryId.value,
    priority: Number(primaryPriority.value || 0),
    enabled: true,
  });
  primaryId.value = '';
  primaryPriority.value = '0';
  await loadRelations();
  emit('changed');
}

async function updatePrimary(relation: CatalogItem, priority: string) {
  await updateCatalogRelation(primaryPath.value, relation.id, {
    priority: Number(priority || 0),
    enabled: relation.enabled !== false,
  });
  await loadRelations();
}

async function deletePrimary(relation: CatalogItem) {
  await deleteCatalogRelation(primaryPath.value, relation.id);
  await loadRelations();
  emit('changed');
}

async function addTimezone() {
  if (!timezoneId.value) {
    return;
  }

  await createCatalogRelation(timezonePath.value, {
    timezonePresetId: timezoneId.value,
    priority: Number(timezonePriority.value || 0),
  });
  timezoneId.value = '';
  timezonePriority.value = '0';
  await loadRelations();
  emit('changed');
}

async function updateTimezone(relation: CatalogItem, priority: string) {
  await updateCatalogRelation(timezonePath.value, relation.id, {
    priority: Number(priority || 0),
  });
  await loadRelations();
}

async function deleteTimezone(relation: CatalogItem) {
  await deleteCatalogRelation(timezonePath.value, relation.id);
  await loadRelations();
  emit('changed');
}

function displayTitle(item: CatalogItem) {
  return String(item.title || item.label || item.timezone || item.id);
}

function displayRelationTitle(relation: CatalogItem, key: 'stream' | 'channel' | 'timezonePreset') {
  const item = relation[key] as CatalogItem | undefined;
  return item ? displayTitle(item) : relation.id;
}
</script>
