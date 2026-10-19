<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShaperStore } from '@/stores/shaper'
import { useFileLoader } from '@/composables/useFileLoader'
import FileDropZone from '@/components/common/FileDropZone.vue'
import RootNotice from '@/components/common/RootNotice.vue'
import ShaperPlot from '@/components/shaper/ShaperPlot.vue'
import ShaperAxisInfo from '@/components/shaper/ShaperAxisInfo.vue'
import SpectrogramPlot from '@/components/shaper/SpectrogramPlot.vue'

const { t } = useI18n()
const shaperStore = useShaperStore()
const { triggerFileInput, handleDrop, handleDragOver } = useFileLoader()

const hasAnyData = computed(() =>
  shaperStore.calibrationDataX !== null || shaperStore.calibrationDataY !== null,
)

const tab = ref<'analysis' | 'spectrogram'>('analysis')

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
    <RootNotice v-if="!hasAnyData" />

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

      <div class="tabs" role="tablist">
        <button
          v-for="key in (['analysis', 'spectrogram'] as const)"
          :key="key"
          role="tab"
          class="tab"
          :class="{ 'tab--active': tab === key }"
          :aria-selected="tab === key"
          @click="tab = key"
        >{{ t(`neo_ui.spectrogram.tab_${key}`) }}</button>
      </div>

      <template v-if="tab === 'spectrogram'">
        <section v-for="ax in (['x', 'y'] as const)" :key="ax" class="axis-section">
          <template v-if="ax === 'x' ? shaperStore.calibrationDataX : shaperStore.calibrationDataY">
            <h2>{{ t(`neo_ui.shaper.axis_${ax}_title`) }}</h2>
            <SpectrogramPlot
              v-if="ax === 'x' ? shaperStore.spectrogramX : shaperStore.spectrogramY"
              :spectrogram="(ax === 'x' ? shaperStore.spectrogramX : shaperStore.spectrogramY)!"
              :mark-freq="(ax === 'x' ? shaperStore.resultX : shaperStore.resultY)?.freq"
            />
            <p v-else class="hint">{{ t('neo_ui.spectrogram.no_raw') }}</p>
          </template>
        </section>

        <div class="guide-card">
          <h3>{{ t('neo_ui.spectrogram.guide_title') }}</h3>
          <ul>
            <li v-for="n in 7" :key="n">{{ t(`neo_ui.spectrogram.guide_${n}`) }}</li>
          </ul>
        </div>
      </template>

      <template v-else>
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

      </template>

      <!-- Klipper config -->
      <div v-if="shaperStore.resultX || shaperStore.resultY" class="config-block">
        <h3>{{ t('neo_ui.shaper.klipper_config') }}</h3>
        <pre class="config-pre">{{ shaperStore.getKlipperConfig() }}</pre>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.tab {
  padding: 8px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-primary);
}

.guide-card {
  padding: 14px 16px;
  margin-bottom: 16px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
}

.guide-card ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

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
