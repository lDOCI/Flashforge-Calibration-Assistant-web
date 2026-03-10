<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBedStore } from '@/stores/bed'
import { useShaperStore } from '@/stores/shaper'
import { useFileLoader } from '@/composables/useFileLoader'

const { t } = useI18n()
const bedStore = useBedStore()
const shaperStore = useShaperStore()
const { triggerFileInput } = useFileLoader()

const log = ref<string[]>([])
const showFlashGuide = ref(true)
const baseUrl = import.meta.env.BASE_URL

function appendLog(msg: string) {
  log.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
}

function downloadCli() {
  window.open('https://github.com/lDOCI/Flashforge-Calibration-Assistant-web/tree/main/cli', '_blank')
}

function downloadWinSCP() {
  window.open('https://winscp.net/eng/download.php', '_blank')
}

// Manual file handling with drag-and-drop on the whole view
function handleDrop(e: DragEvent) {
  e.preventDefault()
  if (!e.dataTransfer?.files) return
  for (const file of e.dataTransfer.files) {
    processFile(file)
  }
}

function processFile(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    const content = reader.result as string
    const name = file.name
    if (name.endsWith('.cfg') || name.endsWith('.conf')) {
      try {
        bedStore.loadFromConfig(content, name.replace(/\.(cfg|conf)$/, ''), name)
        appendLog(t('settings_tab.fill_printer_cfg', { 0: name }))
      } catch (e) {
        appendLog(`Error: ${e instanceof Error ? e.message : e}`)
      }
    } else if (name.endsWith('.csv')) {
      try {
        const axis = name.toLowerCase().includes('_x') ? 'x' as const : 'y' as const
        shaperStore.loadCsv(axis, content)
        appendLog(`${t('settings_tab.fill_shapers', { 0: name })}`)
      } catch (e) {
        appendLog(`Error: ${e instanceof Error ? e.message : e}`)
      }
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <div
    class="data-view"
    @drop="handleDrop"
    @dragover.prevent
  >
    <h1>{{ t('neo_ui.data.title') }}</h1>
    <p class="view-desc">{{ t('neo_ui.data.description') }}</p>

    <!-- Method 1: Flash drive (stock firmware) -->
    <div class="card">
      <div class="card-header" @click="showFlashGuide = !showFlashGuide">
        <div class="card-header-left">
          <span class="method-badge">1</span>
          <h3>{{ t('neo_ui.data.flash_title') }}</h3>
        </div>
        <span class="expand-icon">{{ showFlashGuide ? '−' : '+' }}</span>
      </div>
      <p class="hint">{{ t('neo_ui.data.flash_hint') }}</p>

      <div v-if="showFlashGuide" class="flash-guide">
        <ol class="guide-steps">
          <li>{{ t('neo_ui.data.flash_step_1') }}</li>
          <li>{{ t('neo_ui.data.flash_step_2') }}</li>
          <li>{{ t('neo_ui.data.flash_step_3') }}</li>
          <li>{{ t('neo_ui.data.flash_step_4') }}</li>
          <li>{{ t('neo_ui.data.flash_step_5') }}</li>
          <li>{{ t('neo_ui.data.flash_step_6') }}</li>
        </ol>
        <div class="guide-images">
          <img :src="`${baseUrl}m1.jpg`" alt="Machine Info" />
          <img :src="`${baseUrl}m2.jpg`" alt="Service Menu" />
          <img :src="`${baseUrl}m3.jpg`" alt="Get Config" />
        </div>
      </div>

      <div class="upload-buttons">
        <button class="btn-action" @click="triggerFileInput('.cfg,.conf')">
          {{ t('settings_tab.get_printer_cfg') }}
        </button>
        <button class="btn-action" @click="triggerFileInput('.csv')">
          {{ t('settings_tab.get_shapers') }}
        </button>
      </div>
    </div>

    <!-- Method 2: SSH utility -->
    <div class="card">
      <div class="card-header-left">
        <span class="method-badge">2</span>
        <h3>{{ t('neo_ui.data.ssh_title') }}</h3>
      </div>
      <p class="hint">{{ t('neo_ui.data.ssh_hint') }}</p>

      <div class="ssh-buttons">
        <button class="btn-download" @click="downloadCli">
          {{ t('neo_ui.data.download_cli') }}
        </button>
        <button class="btn-download btn-winscp" @click="downloadWinSCP">
          {{ t('neo_ui.data.download_winscp') }}
        </button>
      </div>

      <pre class="ssh-paths">{{ t('neo_ui.data.ssh_paths') }}</pre>
    </div>

    <!-- Log -->
    <div v-if="log.length > 0" class="card log-card">
      <div class="log-output">
        <div v-for="(line, i) in log" :key="i" class="log-line">{{ line }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-view {
  max-width: 620px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-primary);
}

h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.view-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  margin-bottom: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  margin-bottom: 6px;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.method-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.expand-icon {
  font-size: 16px;
  color: var(--text-muted);
  font-weight: 600;
  width: 20px;
  text-align: center;
}

.hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.flash-guide {
  margin-bottom: 12px;
}

.guide-steps {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.guide-steps li {
  margin-bottom: 2px;
}

.guide-images {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.guide-images img {
  width: 180px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.btn-download {
  background: var(--bg-surface);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  align-self: flex-start;
}

.btn-download:hover {
  background: var(--accent-primary);
  color: #fff;
}

.ssh-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-winscp {
  border-color: var(--text-muted);
  color: var(--text-secondary);
}

.btn-winscp:hover {
  border-color: var(--accent-primary);
  background: var(--accent-primary);
  color: #fff;
}

.ssh-paths {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

.upload-buttons {
  display: flex;
  gap: 6px;
}

.btn-action {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-action:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.log-card {
  padding: 8px 12px;
}

.log-output {
  max-height: 160px;
  overflow-y: auto;
}

.log-line {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  padding: 1px 0;
}
</style>
