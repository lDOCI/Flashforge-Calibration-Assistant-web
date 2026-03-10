<script setup lang="ts">
import { ref } from 'vue'
import TopBar from './TopBar.vue'
import SideMenu from './SideMenu.vue'

const menuOpen = ref(false)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}
</script>

<template>
  <div class="app-layout">
    <TopBar @toggle-menu="toggleMenu" />
    <div class="app-body">
      <div v-if="menuOpen" class="menu-backdrop" @click="closeMenu" />
      <SideMenu :class="{ 'sidemenu--open': menuOpen }" @navigate="closeMenu" />
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
  position: relative;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  background: var(--bg-primary);
}

.menu-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .app-content {
    padding: 12px 14px;
  }

  .menu-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }
}
</style>
