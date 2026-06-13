<template>
  <main class="auth-page app-dark">
    <section class="auth-panel wide">
      <RouterLink class="brand auth-brand" to="/">
        <span class="brand-mark">TV</span>
        <span>
          <strong>{{ t.appTitle }}</strong>
          <small>{{ t.setupTitle }}</small>
        </span>
      </RouterLink>

      <div class="auth-heading">
        <p class="eyebrow">{{ t.setupTitle }}</p>
        <h1>{{ t.createAdmin }}</h1>
        <p>{{ t.setupDescription }}</p>
      </div>

      <form class="auth-form setup-form" @submit.prevent="handleSubmit">
        <label>
          <span>{{ t.email }}</span>
          <input v-model="form.email" autocomplete="email" type="email" />
        </label>

        <label>
          <span>{{ t.username }}</span>
          <input v-model="form.username" autocomplete="username" />
        </label>

        <label>
          <span>{{ t.password }}</span>
          <input v-model="form.password" autocomplete="new-password" minlength="6" type="password" />
        </label>

        <label>
          <span>{{ t.displayName }}</span>
          <input v-model="form.displayName" autocomplete="name" />
        </label>

        <label>
          <span>{{ t.telegramId }}</span>
          <input v-model="form.telegramId" inputmode="numeric" />
        </label>

        <p v-if="auth.error" class="form-error">{{ auth.error }}</p>

        <button class="action-button" type="submit" :disabled="auth.loading">
          {{ auth.loading ? t.checking : t.createAdmin }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import { t } from '../services/i18n';
import { useAuthStore } from '../stores/auth.store';

const auth = useAuthStore();
const router = useRouter();
const form = reactive({
  email: '',
  username: '',
  password: '',
  displayName: '',
  telegramId: '',
});

async function handleSubmit() {
  await auth.setup(form);
  await router.push('/');
}
</script>
