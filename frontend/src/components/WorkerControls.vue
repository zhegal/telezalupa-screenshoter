<template>
  <div class="control-row">
    <button class="action-button" type="button" :disabled="loading" @click="emit('start')">
      Start
    </button>
    <button class="ghost-button control-button" type="button" :disabled="loading" @click="emit('stop')">
      Stop
    </button>
    <button class="ghost-button control-button" type="button" :disabled="loading" @click="emit('restart')">
      Restart
    </button>
    <button class="ghost-button control-button" type="button" :disabled="loading" @click="emit('runOnce')">
      Run once
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean;
}>();

const emit = defineEmits<{
  start: [];
  stop: [];
  restart: [];
  runOnce: [];
}>();
</script>
