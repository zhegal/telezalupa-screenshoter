<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Автоматизация</p>
          <h2>Закрепление по реакциям</h2>
          <p class="page-description">
            Функция выключена по умолчанию и работает только после ручного включения здесь.
          </p>
        </div>
        <span class="pill" :class="settings.autoPinEnabled ? 'level-info' : 'level-warn'">
          {{ settings.autoPinEnabled ? 'включено' : 'выключено' }}
        </span>
      </div>

      <form class="catalog-form telegram-settings-form" @submit.prevent="saveSettings">
        <label class="toggle-line status-toggle">
          <input v-model="settings.autoPinEnabled" type="checkbox" />
          <span>Автоматически закреплять публикации</span>
        </label>
        <label>
          Количество реакций для закрепления
          <input
            v-model.number="settings.reactionThreshold"
            type="number"
            min="1"
            step="1"
            required
          />
        </label>
        <p class="form-section-description">
          Учитывается сумма всех типов реакций. Уже закреплённая публикация больше автоматически не
          изменяется.
        </p>
        <div class="control-row">
          <button class="action-button" type="submit" :disabled="saving || loading">
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <span v-if="message" class="bulk-stats">{{ message }}</span>
        </div>
      </form>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>

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
import {
  getTelegramAutomationSettings,
  getTelegramWebhookStatus,
  updateTelegramAutomationSettings,
  type TelegramAutomationSettings,
  type TelegramWebhookStatus,
} from '../services/api';

const status = ref<TelegramWebhookStatus | null>(null);
const settings = ref<TelegramAutomationSettings>({
  autoPinEnabled: false,
  reactionThreshold: 7,
});
const loading = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');

onMounted(() => {
  void load();
});

async function load() {
  loading.value = true;
  error.value = '';

  try {
    const [webhookStatus, automationSettings] = await Promise.all([
      getTelegramWebhookStatus(),
      getTelegramAutomationSettings(),
    ]);
    status.value = webhookStatus;
    settings.value = automationSettings;
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  error.value = '';
  message.value = '';

  try {
    settings.value = await updateTelegramAutomationSettings(settings.value);
    message.value = settings.value.autoPinEnabled
      ? `Автозакрепление включено: ${settings.value.reactionThreshold} реакций.`
      : 'Автозакрепление выключено.';
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    saving.value = false;
  }
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}
</script>
