<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, tm } = useI18n()
const emit = defineEmits<{ navigate: [] }>()
const baseUrl = import.meta.env.BASE_URL

const navItems = [
  { to: '/', label: 'neo_ui.nav.bed' },
  { to: '/shaper', label: 'neo_ui.nav.shaper' },
  { to: '/ssh', label: 'neo_ui.nav.data' },
  { to: '/settings', label: 'neo_ui.nav.settings' },
]

// Easter egg
const eggClicks = ref(0)
const eggActive = ref(false)
const eggMsg = ref('')
let eggTimer = 0

function onAuthorClick() {
  clearTimeout(eggTimer)
  eggClicks.value++
  if (eggClicks.value >= 20) {
    const msgs = tm('neo_ui.footer.egg') as string[]
    eggMsg.value = Array.isArray(msgs) ? msgs[Math.floor(Math.random() * msgs.length)] : String(msgs)
    eggActive.value = true
    eggClicks.value = 0
    setTimeout(() => { eggActive.value = false }, 8000)
  }
  eggTimer = window.setTimeout(() => { eggClicks.value = 0 }, 3000)
}
</script>

<template>
  <nav class="sidemenu">
    <div class="sidemenu-nav">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        active-class="nav-item--active"
        @click="emit('navigate')"
      >
        {{ t(item.label) }}
      </router-link>
    </div>
    <div class="sidemenu-footer">
      <span class="footer-ver">v2.0</span>
      <span class="footer-author">{{ t('neo_ui.footer.author') }} <span class="author-name" @click="onAuthorClick">I_DOC_I</span></span>
      <Transition name="egg-fade">
        <div v-if="eggActive" class="egg">
          <img :src="`${baseUrl}p.gif`" class="egg-img" alt="" />
          <div class="egg-msg">{{ eggMsg }}</div>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<style scoped>
.sidemenu {
  width: var(--sidebar-width);
  background: var(--bg-surface);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidemenu-nav {
  display: flex;
  flex-direction: column;
  padding: 8px 6px;
  gap: 1px;
}

.nav-item {
  display: block;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 13px;
  transition: all var(--transition-fast);
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  text-decoration: none;
}

.nav-item--active {
  background: var(--bg-hover);
  color: var(--text-primary);
  font-weight: 600;
  border-left: 2px solid var(--accent-primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.nav-item--active:hover {
  background: var(--bg-hover);
}

.sidemenu-footer {
  margin-top: auto;
  padding: 12px;
}

.footer-ver {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}

.footer-author {
  display: block;
  font-size: 9px;
  color: var(--text-muted);
  opacity: 0.5;
  cursor: default;
  user-select: none;
  margin-top: 2px;
}

.author-name {
  cursor: default;
}

/* Easter egg */
.egg {
  margin-top: 10px;
  padding: 10px 8px 8px;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  text-align: center;
  overflow: hidden;
}

.egg-img {
  width: 100px;
  height: 100px;
  object-fit: contain;
  margin-bottom: 6px;
}

.egg-msg {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent-primary);
  font-style: italic;
  line-height: 1.3;
}

.egg-fade-enter-active { animation: egg-pop 0.4s ease-out; }
.egg-fade-leave-active { animation: egg-pop 0.3s ease-in reverse; }

@keyframes egg-pop {
  from { opacity: 0; transform: scale(0.7) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@media (max-width: 768px) {
  .sidemenu {
    position: fixed;
    top: var(--topbar-height);
    left: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: none;
  }

  .sidemenu.sidemenu--open {
    transform: translateX(0);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
  }
}
</style>
