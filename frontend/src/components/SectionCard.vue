<template>
  <RouterLink class="section-card" :to="to">
    <span class="section-icon">
      <AppIcon :name="icon" />
    </span>
    <span>
      <strong>{{ title }}</strong>
      <small>{{ description }}</small>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import AppIcon from './icons/AppIcon.vue';
import type { AppIconName } from './icons/icon.types';

defineProps<{
  to: string;
  title: string;
  description: string;
  icon: AppIconName;
}>();
</script>
