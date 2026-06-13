<template>
  <main class="auth-page app-dark">
    <section class="auth-panel">
      <RouterLink class="brand auth-brand" to="/">
        <span class="brand-mark">TV</span>
        <span>
          <strong>{{ t.appTitle }}</strong>
          <small>{{ t.appSubtitle }}</small>
        </span>
      </RouterLink>

      <div class="auth-heading">
        <p class="eyebrow">{{ t.login }}</p>
        <h1>{{ t.dashboard }}</h1>
        <p>{{ t.temporaryAdminHint }}</p>
      </div>

      <div v-if="auth.configError" class="config-error">
        {{ t.tempAdminPasswordMissing }}
      </div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <label>
          <span>{{ t.login }}</span>
          <input v-model="form.login" autocomplete="username" :placeholder="t.loginPlaceholder" />
        </label>

        <label>
          <span>{{ t.password }}</span>
          <input v-model="form.password" autocomplete="current-password" type="password" />
        </label>

        <p v-if="auth.error" class="form-error">{{ auth.error }}</p>

        <button class="action-button" type="submit" :disabled="auth.loading || Boolean(auth.configError)">
          {{ auth.loading ? t.checking : t.loginAction }}
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
  login: '',
  password: '',
});

async function handleSubmit() {
  await auth.login(form);

  if (auth.isBootstrap) {
    await router.push('/setup');
    return;
  }

  await router.push('/');
}
</script>
