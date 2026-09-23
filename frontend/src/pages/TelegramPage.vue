<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Telegram Bot API</p>
          <h2>Webhook</h2>
          <p class="page-description">
            Адреса и идентификаторы берутся только из переменных окружения.
          </p>
        </div>
        <button class="ghost-button control-button" type="button" :disabled="loading" @click="load">
          Обновить
        </button>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <dl class="meta-grid telegram-webhook-grid">
        <div>
          <dt>Конфигурация</dt>
          <dd>{{ status?.configured ? 'готова' : 'неполная' }}</dd>
        </div>
        <div>
          <dt>Webhook Telegram</dt>
          <dd>{{ status?.remote?.url ? 'активен' : 'не установлен' }}</dd>
        </div>
        <div>
          <dt>Pending updates</dt>
          <dd>{{ status?.remote?.pending_update_count ?? '—' }}</dd>
        </div>
        <div>
          <dt>Последний update</dt>
          <dd>{{ formatDate(status?.lastUpdateAt) }}</dd>
        </div>
        <div>
          <dt>Настроенный URL</dt>
          <dd class="url-cell">{{ status?.expectedUrl || '—' }}</dd>
        </div>
        <div>
          <dt>URL в Telegram</dt>
          <dd class="url-cell">{{ status?.remote?.url || '—' }}</dd>
        </div>
        <div>
          <dt>Allowed updates</dt>
          <dd>{{ status?.remote?.allowed_updates?.join(', ') || '—' }}</dd>
        </div>
      </dl>

      <p v-if="status?.remote?.last_error_message" class="form-error">
        Последняя ошибка Telegram: {{ status.remote.last_error_message }}
      </p>
      <p v-if="status?.error" class="form-error">Ошибка проверки: {{ status.error }}</p>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import { getTelegramWebhookStatus, type TelegramWebhookStatus } from '../services/api';

const status = ref<TelegramWebhookStatus | null>(null);
const loading = ref(false);
const error = ref('');

onMounted(() => {
  void load();
});

async function load() {
  loading.value = true;
  error.value = '';

  try {
    status.value = await getTelegramWebhookStatus();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}
</script>
