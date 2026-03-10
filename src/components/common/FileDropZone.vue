<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFileLoader } from '@/composables/useFileLoader'

const props = defineProps<{ label?: string; accept?: string }>()

const { t } = useI18n()
const { handleDrop, handleDragOver, triggerFileInput } = useFileLoader()
const isDragging = ref(false)

function onDragEnter() { isDragging.value = true }
function onDragLeave() { isDragging.value = false }
function onDrop(e: DragEvent) {
  e.stopPropagation()
  isDragging.value = false
  handleDrop(e)
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'dropzone--active': isDragging }"
    @drop="onDrop"
    @dragover="handleDragOver"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @click="triggerFileInput(props.accept)"
  >
    <span class="dropzone-label">{{ label || t('neo_ui.common.drop_hint') }}</span>
  </div>
</template>

<style scoped>
.dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: calc(100vh - 140px);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dropzone:hover,
.dropzone--active {
  border-color: var(--accent-primary);
  background: rgba(74, 158, 245, 0.04);
}

.dropzone-label {
  font-size: 14px;
  color: var(--text-muted);
}
</style>
