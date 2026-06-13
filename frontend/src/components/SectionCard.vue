<template>
  <RouterLink class="section-card" :to="to">
    <span class="section-icon">{{ icon }}</span>
    <span>
      <strong>{{ title }}</strong>
      <small>{{ description }}</small>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
defineProps<{
  to: string;
  title: string;
  description: string;
  icon: string;
}>();
</script>
