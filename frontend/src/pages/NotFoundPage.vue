<template>
  <main class="auth-page app-dark">
    <section class="auth-panel">
      <RouterLink class="brand auth-brand" to="/">
        <span class="brand-mark">TV</span>
        <span>
          <strong>{{ t.appTitle }}</strong>
          <small>{{ t.notFound }}</small>
        </span>
      </RouterLink>

      <div class="auth-heading">
        <p class="eyebrow">404</p>
        <h1>{{ t.notFound }}</h1>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { t } from '../services/i18n';
</script>
