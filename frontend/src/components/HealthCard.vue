<template>
  <section class="panel health-panel" aria-labelledby="health-title">
    <div class="panel-header">
      <div>
        <p class="eyebrow">{{ t.healthEndpoint }}</p>
        <h2 id="health-title">{{ t.backend }}</h2>
      </div>
      <button class="action-button" type="button" :disabled="health.loading" @click="health.refresh">
        {{ t.refresh }}
      </button>
    </div>

    <div class="health-status" :class="{ online: health.isOnline, offline: !health.isOnline }">
      <span class="health-orb" />
      <div>
        <span>{{ health.loading ? t.checking : health.isOnline ? t.online : t.offline }}</span>
        <strong>{{ health.data?.status || health.error || 'unknown' }}</strong>
      </div>
    </div>

    <dl class="meta-grid">
      <div>
        <dt>{{ t.status }}</dt>
        <dd>{{ health.data?.status || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t.lastCheck }}</dt>
        <dd>{{ health.checkedAt || '—' }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useHealthStore } from '../stores/health.store';
import { t } from '../services/i18n';

const health = useHealthStore();

onMounted(() => {
  void health.refresh();
});
</script>
