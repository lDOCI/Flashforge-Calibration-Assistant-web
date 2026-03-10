<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBedStore } from '@/stores/bed'
import { useSettingsStore } from '@/stores/settings'
import { useFileLoader } from '@/composables/useFileLoader'
import { copyShareUrl } from '@/composables/useShareUrl'
import FileDropZone from '@/components/common/FileDropZone.vue'
import WorkspaceSelector from '@/components/bed/WorkspaceSelector.vue'
import BedHeatmap from '@/components/bed/BedHeatmap.vue'
import BedSurface3D from '@/components/bed/BedSurface3D.vue'
import WorkflowPanel from '@/components/bed/WorkflowPanel.vue'
import TemperaturePanel from '@/components/bed/TemperaturePanel.vue'
import BeltDiagram from '@/components/visual/BeltDiagram.vue'
import ScrewDiagram from '@/components/visual/ScrewDiagram.vue'
import TapeDiagram from '@/components/visual/TapeDiagram.vue'
import type { StageResult } from '@/lib/calibration/types'

const { t } = useI18n()
const bedStore = useBedStore()
const settingsStore = useSettingsStore()
const { handleDrop, handleDragOver } = useFileLoader()

const selectedStage = ref<StageResult | null>(null)
const ws = computed(() => bedStore.activeWorkspace)

// Reset selected stage when switching workspaces
watch(() => bedStore.activeIndex, () => {
  selectedStage.value = null
})

const displayMesh = computed(() => {
  if (selectedStage.value) return selectedStage.value.mesh
  return ws.value?.bed.meshData ?? []
})

const stats = computed(() => {
  if (!ws.value) return null
  const mesh = ws.value.bed.meshData!
  const flat = mesh.flat()
  const maxH = Math.max(...flat)
  const minH = Math.min(...flat)
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length
  return {
    delta: (maxH - minH).toFixed(3),
    mean: mean.toFixed(3),
    max: maxH.toFixed(3),
    min: minH.toFixed(3),
  }
})

function deviationQuality(delta: string): 'good' | 'ok' | 'warn' | 'bad' {
  const v = parseFloat(delta)
  if (v < 0.05) return 'good'
  if (v < 0.15) return 'ok'
  if (v < 0.3) return 'warn'
  return 'bad'
}

const currentStageActions = computed(() => {
  if (!selectedStage.value) return { belt: [], screw: [], tape: [] }
  const actions = selectedStage.value.actions
  return {
    belt: actions.filter(a => a.kind === 'belt'),
    screw: actions.filter(a => a.kind === 'screw'),
    tape: actions.filter(a => a.kind === 'tape'),
  }
})

function onSelectStage(stage: StageResult) {
  selectedStage.value = stage
}

const shareStatus = ref('')
async function onShare() {
  try {
    await copyShareUrl()
    shareStatus.value = t('neo_ui.bed.share_copied')
    setTimeout(() => { shareStatus.value = '' }, 3000)
  } catch (e) {
    shareStatus.value = String(e instanceof Error ? e.message : e)
  }
}
</script>

<template>
  <div
    class="bed-view"
    @drop="handleDrop"
    @dragover="handleDragOver"
  >
    <div class="header-row">
      <h1>{{ t('neo_ui.bed.header') }}</h1>
      <div class="header-actions">
        <button v-if="bedStore.hasData" class="btn-share" @click="onShare">
          {{ t('neo_ui.bed.share') }}
        </button>
        <span v-if="shareStatus" class="share-status">{{ shareStatus }}</span>
      </div>
    </div>

    <template v-if="!bedStore.hasData">
      <FileDropZone
        :label="t('neo_ui.bed.status.load_hint')"
        accept=".cfg,.conf"
      />
    </template>

    <template v-else>
      <WorkspaceSelector />

      <!-- Hero metric: max deviation -->
      <div v-if="stats" class="hero-stats">
        <div class="hero-metric" :class="'hero--' + deviationQuality(stats.delta)">
          <span class="hero-value">{{ stats.delta }}</span>
          <span class="hero-unit">mm</span>
          <span class="hero-label">{{ t('neo_ui.bed.cards.max_delta') }}</span>
        </div>
        <div class="secondary-stats">
          <div class="sec-stat">
            <span class="sec-label">{{ t('neo_ui.bed.cards.mean_height') }}</span>
            <span class="sec-value">{{ stats.mean }} mm</span>
          </div>
          <div class="sec-stat">
            <span class="sec-label">{{ t('neo_ui.bed.cards.max_height') }}</span>
            <span class="sec-value">{{ stats.max }} mm</span>
          </div>
          <div class="sec-stat">
            <span class="sec-label">{{ t('neo_ui.bed.cards.min_height') }}</span>
            <span class="sec-value">{{ stats.min }} mm</span>
          </div>
        </div>
      </div>

      <!-- Charts centered -->
      <div class="charts-row">
        <div class="chart-col">
          <BedHeatmap
            :key="'hm-' + (ws?.id ?? '')"
            :mesh="displayMesh"
          />
        </div>
        <div class="chart-col">
          <BedSurface3D
            :key="'3d-' + (ws?.id ?? '')"
            :mesh="displayMesh"
          />
        </div>
      </div>

      <!-- Stage visual diagrams -->
      <div v-if="selectedStage && selectedStage.actions.length > 0" class="diagrams-row">
        <BeltDiagram
          v-if="currentStageActions.belt.length > 0"
          :actions="currentStageActions.belt"
        />
        <ScrewDiagram
          v-if="currentStageActions.screw.length > 0"
          :actions="currentStageActions.screw"
          :screw-mode="settingsStore.settings.hardware.screw_mode"
        />
        <TapeDiagram
          v-if="currentStageActions.tape.length > 0"
          :actions="currentStageActions.tape"
          :rows="ws!.meshData.yCount"
          :cols="ws!.meshData.xCount"
        />
      </div>

      <!-- Workflow panel -->
      <WorkflowPanel
        v-if="ws?.workflow"
        :workflow="ws.workflow"
        @select-stage="onSelectStage"
      />

      <!-- Temperature visualization -->
      <TemperaturePanel v-if="ws?.workflow" />
    </template>
  </div>
</template>

<style scoped>
.bed-view {
  max-width: 100%;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-share {
  padding: 4px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-share:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.share-status {
  font-size: 12px;
  color: var(--status-good);
}

/* ---- Hero metric ---- */
.hero-stats {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 16px;
  padding: 14px 20px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
}

.hero-metric {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  border-left: 3px solid var(--status-bad);
  padding-left: 14px;
}

.hero--good { border-left-color: var(--status-good); }
.hero--ok { border-left-color: var(--status-ok); }
.hero--warn { border-left-color: var(--status-warn); }
.hero--bad { border-left-color: var(--status-bad); }

.hero-value {
  font-size: 32px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
  line-height: 1;
}

.hero-unit {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  align-self: flex-end;
  margin-bottom: 2px;
}

.hero-label {
  width: 100%;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-top: 2px;
}

.secondary-stats {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-left: auto;
}

.sec-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sec-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted);
}

.sec-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* ---- Charts: full width, no max-width constraint ---- */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 900px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

.chart-col {
  min-width: 0;
}

/* ---- Diagrams centered ---- */
.diagrams-row {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
</style>
