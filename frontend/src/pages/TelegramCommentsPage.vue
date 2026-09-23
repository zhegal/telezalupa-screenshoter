<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Telegram discussion</p>
          <h2>Комментарии</h2>
          <p class="page-description">
            Сообщения хранятся без медиафайлов. Блокировка не удаляет запись комментария из панели.
          </p>
        </div>
        <button
          class="ghost-button control-button"
          type="button"
          :disabled="loading"
          @click="refresh"
        >
          Обновить
        </button>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-if="message" class="bulk-stats">{{ message }}</p>
      <p v-if="!loading && comments.length === 0" class="empty-state">Комментариев пока нет.</p>

      <div class="telegram-comment-list">
        <article v-for="comment in comments" :key="comment.id" class="telegram-comment-card">
          <div class="telegram-comment-header">
            <div>
              <strong>{{ comment.authorDisplayName }}</strong>
              <span v-if="comment.authorUsername">@{{ comment.authorUsername }}</span>
              <span v-if="comment.telegramUserId">ID {{ comment.telegramUserId }}</span>
            </div>
            <time :datetime="comment.messageCreatedAt">{{
              formatDate(comment.messageCreatedAt)
            }}</time>
          </div>

          <p class="telegram-comment-publication">
            Публикация: {{ comment.publication.channelTitle }} · message
            {{ comment.publication.messageId }}
          </p>
          <p v-if="comment.text" class="telegram-comment-text">{{ comment.text }}</p>
          <p v-else class="telegram-comment-text muted">Текст отсутствует.</p>

          <div class="relation-summary">
            <span v-if="comment.hasMedia" class="pill level-info">есть медиа</span>
            <span v-if="comment.messageEditedAt" class="pill">изменён</span>
            <span v-if="comment.ban" class="pill" :class="banClass(comment.ban.status)">
              бан: {{ banLabel(comment.ban.status) }}
            </span>
          </div>

          <label v-if="comment.telegramUserId" class="telegram-comment-note">
            Личная пометка
            <textarea
              v-model="notes[comment.id]"
              maxlength="2000"
              placeholder="Причина блокировки или другая служебная информация"
            />
          </label>

          <p v-if="comment.ban?.errorMessage" class="form-error">
            Ошибка блокировки: {{ comment.ban.errorMessage }}
          </p>

          <div class="control-row telegram-comment-actions">
            <a
              class="ghost-button control-button"
              :href="comment.telegramUrl"
              target="_blank"
              rel="noreferrer"
            >
              Открыть комментарий
            </a>
            <button
              v-if="comment.telegramUserId && comment.ban?.status !== 'completed'"
              class="ghost-button control-button danger"
              type="button"
              :disabled="activeCommentId === comment.id || comment.ban?.status === 'pending'"
              @click="banAuthor(comment)"
            >
              {{
                comment.ban?.status === 'error' ? 'Повторить блокировку' : 'Заблокировать автора'
              }}
            </button>
            <button
              v-if="comment.ban"
              class="ghost-button control-button"
              type="button"
              :disabled="activeCommentId === comment.id"
              @click="saveNote(comment)"
            >
              Сохранить пометку
            </button>
            <span v-if="!comment.telegramUserId" class="form-section-description">
              Сообщение отправлено от имени чата — блокировка пользователя недоступна.
            </span>
          </div>
        </article>
      </div>

      <PaginationControls
        :total="total"
        :offset="offset"
        :page-size="pageSize"
        :sizes="[25, 50, 100]"
        @change-page="changePage"
        @change-page-size="changePageSize"
      />
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import PaginationControls from '../components/PaginationControls.vue';
import {
  banTelegramCommentAuthor,
  getTelegramComments,
  updateTelegramBanNote,
  type TelegramComment,
  type TelegramUserBan,
} from '../services/api';

const comments = ref<TelegramComment[]>([]);
const notes = reactive<Record<string, string>>({});
const total = ref(0);
const offset = ref(0);
const pageSize = ref(Number(localStorage.getItem('telegramCommentsPageSize') || 50));
const loading = ref(false);
const activeCommentId = ref<string | null>(null);
const error = ref('');
const message = ref('');

onMounted(() => {
  void refresh();
});

async function refresh() {
  loading.value = true;
  error.value = '';

  try {
    const response = await getTelegramComments({ limit: pageSize.value, offset: offset.value });
    comments.value = response.items;
    total.value = response.total;
    for (const comment of response.items) {
      notes[comment.id] = comment.ban?.note || '';
    }
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function banAuthor(comment: TelegramComment) {
  const confirmed = window.confirm(
    `Навсегда заблокировать ${comment.authorDisplayName} в discussion-группе?`,
  );
  if (!confirmed) return;

  activeCommentId.value = comment.id;
  error.value = '';
  message.value = '';

  try {
    comment.ban = await banTelegramCommentAuthor(comment.id, notes[comment.id] || '');
    notes[comment.id] = comment.ban.note || '';
    message.value = `Автор ${comment.authorDisplayName} заблокирован.`;
  } catch (err) {
    error.value = getErrorMessage(err);
    await refresh();
  } finally {
    activeCommentId.value = null;
  }
}

async function saveNote(comment: TelegramComment) {
  if (!comment.ban) return;

  activeCommentId.value = comment.id;
  error.value = '';
  message.value = '';

  try {
    comment.ban = await updateTelegramBanNote(comment.ban.id, notes[comment.id] || '');
    notes[comment.id] = comment.ban.note || '';
    message.value = 'Личная пометка сохранена.';
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    activeCommentId.value = null;
  }
}

async function changePage(nextOffset: number) {
  offset.value = nextOffset;
  await refresh();
}

async function changePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize;
  localStorage.setItem('telegramCommentsPageSize', String(nextPageSize));
  offset.value = 0;
  await refresh();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU');
}

function banLabel(status: TelegramUserBan['status']): string {
  return status === 'completed' ? 'выполнен' : status === 'pending' ? 'выполняется' : 'ошибка';
}

function banClass(status: TelegramUserBan['status']): string {
  return status === 'completed' ? 'level-info' : status === 'error' ? 'level-error' : 'level-warn';
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
</script>
