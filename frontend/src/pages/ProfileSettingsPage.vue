<template>
  <AdminLayout>
    <section class="panel wide-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Settings / Profile</p>
          <h2>Profile</h2>
        </div>
        <span class="pill level-warn">placeholder</span>
      </div>

      <dl class="meta-grid">
        <div>
          <dt>Username</dt>
          <dd>{{ auth.user?.username || '—' }}</dd>
        </div>
        <div>
          <dt>Display name</dt>
          <dd>{{ auth.user?.displayName || '—' }}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{{ auth.user?.email || '—' }}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{{ auth.user?.role || '—' }}</dd>
        </div>
      </dl>

      <p class="catalog-warning">
        Profile editing will be implemented in a later user management stage.
      </p>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import AdminLayout from '../layouts/AdminLayout.vue';
import { useAuthStore } from '../stores/auth.store';

const auth = useAuthStore();
</script>
