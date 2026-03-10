<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useBedStore } from '@/stores/bed'
import { useFileLoader } from '@/composables/useFileLoader'

const { t } = useI18n()
const bedStore = useBedStore()
const { triggerFileInput } = useFileLoader()
</script>

<template>
  <div class="workspace-selector" v-if="bedStore.workspaces.length > 0">
    <div class="ws-tabs">
      <button
        v-for="(ws, idx) in bedStore.workspaces"
        :key="ws.id"
        class="ws-tab"
        :class="{ 'ws-tab--active': idx === bedStore.activeIndex }"
        @click="bedStore.setActive(idx)"
      >
        {{ ws.name }}
        <span
          class="ws-close"
          @click.stop="bedStore.removeWorkspace(idx)"
        >&times;</span>
      </button>
    </div>
    <button class="ws-add" @click="triggerFileInput('.cfg,.conf')" :title="t('neo_ui.common.load_another')">+</button>
  </div>
</template>

<style scoped>
.workspace-selector {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.ws-tabs {
  display: flex;
  gap: 0;
}

.ws-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
  margin-bottom: -1px;
}

.ws-tab:hover {
  color: var(--text-primary);
}

.ws-tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-primary);
  font-weight: 600;
}

.ws-close {
  font-size: 14px;
  opacity: 0;
  line-height: 1;
  color: var(--text-muted);
  transition: opacity var(--transition-fast);
}

.ws-tab:hover .ws-close {
  opacity: 0.6;
}

.ws-close:hover {
  opacity: 1;
  color: var(--accent-error);
}

.ws-add {
  width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 16px;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  margin-bottom: -1px;
  transition: all var(--transition-fast);
}

.ws-add:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
</style>
