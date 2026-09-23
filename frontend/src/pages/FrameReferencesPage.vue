<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Контроль качества кадров</p>
          <h2>Запрещённые референсы</h2>
          <p class="page-description">
            Совпавшие по миниатюре кадры не публикуются. Поддерживаются JPEG, PNG и WebP до 10 МБ.
          </p>
        </div>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="load">
          Обновить
        </button>
      </div>

      <form class="reference-upload-form" @submit.prevent="upload">
        <label>
          Подпись
          <input
            v-model="newLabel"
            maxlength="120"
            required
            placeholder="Например: чёрный экран OTT"
          />
        </label>
        <label>
          Изображение
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            @change="selectFile"
          />
        </label>
        <button class="action-button" type="submit" :disabled="saving || !newFile">
          {{ saving ? 'Загрузка…' : 'Добавить референс' }}
        </button>
      </form>

      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-if="success" class="form-success">{{ success }}</p>

      <div v-if="loading" class="empty-state">Загрузка…</div>
      <div v-else-if="references.length === 0" class="empty-state">
        Запрещённые референсы ещё не добавлены.
      </div>
      <div v-else class="reference-grid">
        <article v-for="reference in references" :key="reference.id" class="reference-card">
          <img :src="reference.previewUrl" :alt="reference.label" loading="lazy" />
          <div class="reference-card-body">
            <input
              v-model="labels[reference.id]"
              class="filter-input reference-label-input"
              maxlength="120"
            />
            <small>{{ reference.thumbnailHash.slice(0, 16) }}…</small>
            <div class="control-row">
              <button
                class="ghost-button control-button"
                type="button"
                :disabled="
                  busyId === reference.id || labels[reference.id]?.trim() === reference.label
                "
                @click="rename(reference)"
              >
                Сохранить
              </button>
              <button
                class="ghost-button control-button danger"
                type="button"
                :disabled="busyId === reference.id"
                @click="remove(reference)"
              >
                Удалить
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import {
  createForbiddenFrameReference,
  deleteForbiddenFrameReference,
  getForbiddenFrameReferences,
  updateForbiddenFrameReference,
  type ForbiddenFrameReference,
} from '../services/api';

const references = ref<ForbiddenFrameReference[]>([]);
const labels = ref<Record<string, string>>({});
const newLabel = ref('');
const newFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const saving = ref(false);
const busyId = ref<string | null>(null);
const error = ref('');
const success = ref('');

onMounted(() => {
  void load();
});

async function load() {
  loading.value = true;
  error.value = '';

  try {
    references.value = await getForbiddenFrameReferences();
    labels.value = Object.fromEntries(references.value.map((item) => [item.id, item.label]));
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

function selectFile(event: Event) {
  newFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

async function upload() {
  if (!newFile.value || !newLabel.value.trim()) {
    return;
  }

  saving.value = true;
  error.value = '';
  success.value = '';

  try {
    await createForbiddenFrameReference(newLabel.value.trim(), newFile.value);
    newLabel.value = '';
    newFile.value = null;
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    success.value = 'Референс добавлен.';
    await load();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    saving.value = false;
  }
}

async function rename(reference: ForbiddenFrameReference) {
  const label = labels.value[reference.id]?.trim();

  if (!label) {
    error.value = 'Подпись не может быть пустой.';
    return;
  }

  busyId.value = reference.id;
  error.value = '';
  success.value = '';

  try {
    await updateForbiddenFrameReference(reference.id, label);
    success.value = 'Подпись обновлена.';
    await load();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    busyId.value = null;
  }
}

async function remove(reference: ForbiddenFrameReference) {
  if (!window.confirm(`Удалить референс «${reference.label}»?`)) {
    return;
  }

  busyId.value = reference.id;
  error.value = '';
  success.value = '';

  try {
    await deleteForbiddenFrameReference(reference.id);
    success.value = 'Референс удалён.';
    await load();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    busyId.value = null;
  }
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
</script>
