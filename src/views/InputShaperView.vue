<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShaperStore } from '@/stores/shaper'
import { useFileLoader } from '@/composables/useFileLoader'
import FileDropZone from '@/components/common/FileDropZone.vue'
import ShaperPlot from '@/components/shaper/ShaperPlot.vue'
import ShaperAxisInfo from '@/components/shaper/ShaperAxisInfo.vue'

const { t } = useI18n()
const shaperStore = useShaperStore()
const { triggerFileInput, handleDrop, handleDragOver } = useFileLoader()

const hasAnyData = computed(() =>
  shaperStore.calibrationDataX !== null || shaperStore.calibrationDataY !== null,
)

function copyConfig() {
  const config = shaperStore.getKlipperConfig()
  navigator.clipboard.writeText(config)
}
</script>

<template>
  <div
    class="shaper-view"
    @drop="handleDrop"
    @dragover="handleDragOver"
  >
    <h1>{{ t('neo_ui.shaper.header') }}</h1>

    <div v-if="!hasAnyData" class="upload-section">
      <FileDropZone
        :label="t('neo_ui.shaper.placeholder')"
        accept=".csv"
        @click="triggerFileInput('.csv')"
      />
      <p class="hint">{{ t('neo_ui.shaper.csv_hint') }}</p>
    </div>

    <template v-else>
      <div class="toolbar">
        <button class="btn" @click="triggerFileInput('.csv')">{{ t('neo_ui.shaper.load_more') }}</button>
        <button class="btn btn--accent" @click="copyConfig">{{ t('neo_ui.shaper.copy_config') }}</button>
      </div>

      <!-- Axis X -->
      <section v-if="shaperStore.calibrationDataX" class="axis-section">
        <h2>{{ t('neo_ui.shaper.axis_x_title') }}</h2>
        <ShaperPlot
          :calibration-data="shaperStore.calibrationDataX"
          :all-shapers="shaperStore.allShapersX"
          :selected-shaper="shaperStore.selectedShaperX"
          :title="t('shaper_graphs.freq_response_x')"
        />
        <ShaperAxisInfo
          axis="X"
          :result="shaperStore.resultX"
          :all-shapers="shaperStore.allShapersX"
          :selected-shaper="shaperStore.selectedShaperX"
          @select-shaper="(name: string) => shaperStore.selectShaper('x', name)"
        />
      </section>

      <!-- Axis Y -->
      <section v-if="shaperStore.calibrationDataY" class="axis-section">
        <h2>{{ t('neo_ui.shaper.axis_y_title') }}</h2>
        <ShaperPlot
          :calibration-data="shaperStore.calibrationDataY"
          :all-shapers="shaperStore.allShapersY"
          :selected-shaper="shaperStore.selectedShaperY"
          :title="t('shaper_graphs.freq_response_y')"
        />
        <ShaperAxisInfo
          axis="Y"
          :result="shaperStore.resultY"
          :all-shapers="shaperStore.allShapersY"
          :selected-shaper="shaperStore.selectedShaperY"
          @select-shaper="(name: string) => shaperStore.selectShaper('y', name)"
        />
      </section>

      <!-- Klipper config -->
      <div v-if="shaperStore.resultX || shaperStore.resultY" class="config-block">
        <h3>{{ t('neo_ui.shaper.klipper_config') }}</h3>
        <pre class="config-pre">{{ shaperStore.getKlipperConfig() }}</pre>
      </div>
    </template>
  </div>
</template>

<style scoped>
.shaper-view {
  max-width: 100%;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

h3 {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 6px;
}

.hint {
  color: var(--text-muted);
  font-size: 11px;
  margin-top: 6px;
}

.toolbar {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.btn--accent {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.btn--accent:hover {
  background: var(--accent-primary-hover);
}

.axis-section {
  margin-bottom: 24px;
}

.config-block {
  margin-top: 16px;
}

.config-pre {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 12px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-primary);
  white-space: pre;
  overflow-x: auto;
}

.upload-section {
}
</style>
