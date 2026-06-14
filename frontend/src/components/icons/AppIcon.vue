<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="path in paths" :key="path" :d="path" />
    <circle v-if="circle" :cx="circle.cx" :cy="circle.cy" :r="circle.r" />
    <polyline v-if="polyline" :points="polyline" />
    <line v-for="line in lines" :key="line.join('-')" :x1="line[0]" :y1="line[1]" :x2="line[2]" :y2="line[3]" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AppIconName } from './icon.types';

const props = defineProps<{
  name: AppIconName;
}>();

const iconMap: Record<
  AppIconName,
  {
    paths?: string[];
    circle?: { cx: number; cy: number; r: number };
    polyline?: string;
    lines?: [number, number, number, number][];
  }
> = {
  activity: {
    paths: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  },
  dashboard: {
    paths: ['M3 13h8V3H3z', 'M13 21h8V11h-8z', 'M13 3v6h8V3z', 'M3 21h8v-6H3z'],
  },
  'file-list': {
    paths: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
    lines: [
      [8, 13, 16, 13],
      [8, 17, 16, 17],
      [8, 9, 10, 9],
    ],
  },
  logs: {
    paths: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  },
  play: {
    paths: ['M8 5v14l11-7z'],
  },
  radio: {
    paths: ['M4.9 19.1a10 10 0 0 1 0-14.2', 'M7.8 16.2a6 6 0 0 1 0-8.4', 'M16.2 7.8a6 6 0 0 1 0 8.4', 'M19.1 4.9a10 10 0 0 1 0 14.2'],
    circle: { cx: 12, cy: 12, r: 2 },
  },
  send: {
    paths: ['M22 2 11 13', 'M22 2 15 22 11 13 2 9z'],
  },
  settings: {
    paths: ['M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.49.63 1 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z'],
  },
  square: {
    paths: ['M5 5h14v14H5z'],
  },
  tv: {
    paths: ['M7 21h10', 'M12 17v4', 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z'],
  },
};

const current = computed(() => iconMap[props.name]);
const paths = computed(() => current.value.paths ?? []);
const circle = computed(() => current.value.circle);
const polyline = computed(() => current.value.polyline);
const lines = computed(() => current.value.lines ?? []);
</script>
