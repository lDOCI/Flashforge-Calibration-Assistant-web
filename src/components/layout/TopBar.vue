<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'

const { t, locale } = useI18n()
const appStore = useAppStore()
const emit = defineEmits<{ 'toggle-menu': [] }>()

function toggleTheme() {
  appStore.toggleTheme()
}

function toggleLang() {
  locale.value = locale.value === 'en' ? 'ru' : 'en'
  localStorage.setItem('locale', locale.value)
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button class="burger" @click="emit('toggle-menu')">
        <span /><span /><span />
      </button>
      <img class="topbar-logo" src="/favicon.svg" alt="Logo" />
      <span class="topbar-title">{{ t('neo_ui.top_bar.title') }}</span>
    </div>
    <div class="topbar-right">
      <button class="btn btn-sm" @click="toggleTheme">
        {{ appStore.theme === 'dark' ? '☀' : '☾' }}
      </button>
      <button class="btn btn-sm" @click="toggleLang">
        {{ locale.toUpperCase() }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--topbar-height);
  padding: 0 20px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.burger {
  display: none;
  flex-direction: column;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
}

.burger span {
  display: block;
  width: 18px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 1px;
}

.topbar-logo {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
}

.topbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .burger {
    display: flex;
  }

  .topbar-title {
    font-size: 12px;
  }

  .topbar {
    padding: 0 12px;
  }
}
</style>
