<template>
  <AdminLayout>
    <div class="dashboard-grid">
      <HealthCard />

      <section class="panel overview-panel">
        <p class="eyebrow">{{ t.futureSections }}</p>
        <h2>{{ t.appTitle }}</h2>
        <p>{{ t.mobileHint }}</p>
      </section>
    </div>

    <section class="sections-block" aria-labelledby="sections-title">
      <div class="section-heading">
        <p class="eyebrow">{{ t.futureSections }}</p>
        <h2 id="sections-title">{{ t.dashboard }}</h2>
      </div>

      <div class="section-grid">
        <SectionCard
          v-for="section in sections"
          :key="section.to"
          :to="section.to"
          :title="section.title"
          :description="section.description"
          :icon="section.icon"
        />
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import AdminLayout from '../layouts/AdminLayout.vue';
import HealthCard from '../components/HealthCard.vue';
import SectionCard from '../components/SectionCard.vue';
import { t } from '../services/i18n';

const sections = [
  {
    to: '/worker',
    title: t.sections.worker,
    description: t.sectionDescriptions.worker,
    icon: '▶',
  },
  {
    to: '/telegram',
    title: t.sections.telegram,
    description: t.sectionDescriptions.telegram,
    icon: '✉',
  },
  {
    to: '/playlists',
    title: t.sections.playlists,
    description: t.sectionDescriptions.playlists,
    icon: '≡',
  },
  {
    to: '/channels',
    title: t.sections.channels,
    description: t.sectionDescriptions.channels,
    icon: '◉',
  },
  {
    to: '/settings',
    title: t.sections.settings,
    description: t.sectionDescriptions.settings,
    icon: '⚙',
  },
];
</script>
