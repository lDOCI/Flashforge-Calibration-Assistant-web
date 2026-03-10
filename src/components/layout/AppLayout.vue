<script setup lang="ts">
import TopBar from './TopBar.vue'
import SideMenu from './SideMenu.vue'
</script>

<template>
  <div class="app-layout">
    <TopBar />
    <div class="app-body">
      <SideMenu />
      <main class="app-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  background: var(--bg-primary);
}
</style>
