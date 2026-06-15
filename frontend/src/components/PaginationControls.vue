<template>
  <div class="pagination-row">
    <div class="pagination-meta">
      {{ from }}-{{ to }} из {{ total }}
    </div>
    <select class="filter-input compact" :value="pageSize" @change="emitPageSize">
      <option v-for="size in sizes" :key="size" :value="size">{{ size }}</option>
    </select>
    <button class="ghost-button control-button" type="button" :disabled="offset <= 0" @click="emit('change-page', previousOffset)">
      Назад
    </button>
    <button class="ghost-button control-button" type="button" :disabled="offset + pageSize >= total" @click="emit('change-page', nextOffset)">
      Вперёд
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  total: number;
  offset: number;
  pageSize: number;
  sizes?: number[];
}>();

const emit = defineEmits<{
  'change-page': [offset: number];
  'change-page-size': [pageSize: number];
}>();

const sizes = computed(() => props.sizes || [50, 100, 200]);
const from = computed(() => (props.total === 0 ? 0 : props.offset + 1));
const to = computed(() => Math.min(props.offset + props.pageSize, props.total));
const previousOffset = computed(() => Math.max(0, props.offset - props.pageSize));
const nextOffset = computed(() => props.offset + props.pageSize);

function emitPageSize(event: Event) {
  emit('change-page-size', Number((event.target as HTMLSelectElement).value));
}
</script>
