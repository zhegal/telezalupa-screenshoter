<template>
  <div class="table-wrap">
    <table class="runtime-table">
      <thead>
        <tr>
          <th>Level</th>
          <th>Scope</th>
          <th>Message</th>
          <th>Created</th>
          <th>Context</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in logs" :key="entry.id">
          <td>
            <span class="pill" :class="`level-${entry.level}`">{{ entry.level }}</span>
          </td>
          <td>{{ entry.scope }}</td>
          <td>{{ entry.message }}</td>
          <td>{{ formatDate(entry.createdAt) }}</td>
          <td>
            <details v-if="entry.context">
              <summary>{{ contextPreview(entry.context) }}</summary>
              <pre>{{ JSON.stringify(entry.context, null, 2) }}</pre>
            </details>
            <span v-else class="muted">—</span>
          </td>
        </tr>
        <tr v-if="logs.length === 0">
          <td colspan="5" class="empty-cell">No logs yet</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { RuntimeLogEntry } from '../services/api';

defineProps<{
  logs: RuntimeLogEntry[];
}>();

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}

function contextPreview(value: Record<string, unknown>) {
  return JSON.stringify(value).slice(0, 80);
}
</script>
