<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFileLoader } from '@/composables/useFileLoader'

/**
 * Drop a file anywhere in the window: while a file is dragged over the page
 * the whole window becomes the drop target, so there is nothing to miss.
 */
const { t } = useI18n()
const { handleDrop } = useFileLoader()
const visible = ref(false)
let hideTimer = 0

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

// dragover fires continuously while the cursor is over the window; when it
// stops (cursor left the window, or Esc), the overlay hides itself.
function onDragOver(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  visible.value = true
  clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => (visible.value = false), 200)
}

function onDrop(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  e.stopPropagation()
  clearTimeout(hideTimer)
  visible.value = false
  handleDrop(e)
}

onMounted(() => {
  window.addEventListener('dragover', onDragOver)
  // Capture phase, so page-level drop handlers do not load the file twice.
  window.addEventListener('drop', onDrop, true)
})
onUnmounted(() => {
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('drop', onDrop, true)
  clearTimeout(hideTimer)
})
</script>

<template>
  <div v-if="visible" class="drag-overlay">
    <div class="drag-box">
      <span class="drag-icon">⬇</span>
      <b>{{ t('neo_ui.common.drop_release') }}</b>
      <span>printer.cfg · calibration_data_*.csv</span>
    </div>
  </div>
</template>

<style scoped>
.drag-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(10, 14, 24, 0.75);
  pointer-events: none;
}

.drag-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  border: 3px dashed var(--accent-primary);
  border-radius: var(--radius-md, 12px);
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.drag-box b {
  font-size: 20px;
  color: #fff;
}

.drag-icon {
  font-size: 40px;
  color: var(--accent-primary);
}
</style>
