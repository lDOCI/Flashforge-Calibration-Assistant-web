<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
const layerCount = ref(5)
let eggTimer = 0

const eggMessages = [
  'Perfect first layer!',
  'Bed is level. Trust me.',
  'Your belts are perfectly tensioned... probably.',
  'Печатай, не бойся.',
  '0.00mm deviation. We did it.',
  'The nozzle whisperer has arrived.',
]

function onAuthorClick() {
  clearTimeout(eggTimer)
  eggClicks.value++
  if (eggClicks.value >= 20) {
    eggMsg.value = eggMessages[Math.floor(Math.random() * eggMessages.length)]
    layerCount.value = 3 + Math.floor(Math.random() * 5)
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
      >
        {{ t(item.label) }}
      </router-link>
    </div>
    <div class="sidemenu-footer">
      <span class="footer-ver">v2.0</span>
      <span class="footer-author">{{ t('neo_ui.footer.author') }} <span class="author-name" @click="onAuthorClick">I_DOC_I</span></span>
      <Transition name="egg-fade">
        <div v-if="eggActive" class="egg">
          <div class="egg-scene">
            <div class="egg-frame">
              <div class="egg-gantry">
                <div class="egg-head"></div>
              </div>
              <div class="egg-layers">
                <div v-for="i in layerCount" :key="i" class="egg-layer" :style="{ animationDelay: `${i * 0.3}s` }"></div>
              </div>
              <div class="egg-bed-plate"></div>
            </div>
          </div>
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

/* Easter egg — mini printer animation */
.egg {
  margin-top: 10px;
  padding: 10px 8px 8px;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  text-align: center;
  overflow: hidden;
}

.egg-scene {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.egg-frame {
  width: 100px;
  height: 70px;
  position: relative;
  border: 2px solid var(--text-muted);
  border-top: none;
  border-radius: 0 0 4px 4px;
}

.egg-frame::before,
.egg-frame::after {
  content: '';
  position: absolute;
  top: -30px;
  width: 2px;
  height: 30px;
  background: var(--text-muted);
}

.egg-frame::before { left: 0; }
.egg-frame::after { right: 0; }

.egg-gantry {
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--text-muted);
}

.egg-head {
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--accent-primary);
  border-radius: 2px;
  top: -4px;
  animation: egg-move-head 2s ease-in-out infinite;
}

@keyframes egg-move-head {
  0%, 100% { left: 8px; }
  25% { left: 78px; }
  50% { left: 78px; }
  75% { left: 8px; }
}

.egg-layers {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column-reverse;
  gap: 1px;
}

.egg-layer {
  width: 50px;
  height: 3px;
  background: var(--accent-primary);
  border-radius: 1px;
  opacity: 0;
  animation: egg-layer-appear 0.4s forwards;
}

@keyframes egg-layer-appear {
  from { opacity: 0; width: 0; }
  to { opacity: 0.7; width: 50px; }
}

.egg-bed-plate {
  position: absolute;
  bottom: 0;
  left: 4px;
  right: 4px;
  height: 3px;
  background: var(--text-muted);
  border-radius: 1px;
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
</style>
