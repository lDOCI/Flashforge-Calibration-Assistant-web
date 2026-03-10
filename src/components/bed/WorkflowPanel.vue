<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import type { WorkflowData, StageResult, StageAction } from '@/lib/calibration/types'

const props = defineProps<{
  workflow: WorkflowData
}>()

const settingsStore = useSettingsStore()

const emit = defineEmits<{
  selectStage: [stage: StageResult]
}>()

const { t } = useI18n()

const expandedStageKey = ref<string | null>(null)

function deviationColor(deviation: number): string {
  if (deviation < 0.05) return 'var(--status-good)'
  if (deviation < 0.15) return 'var(--status-ok)'
  if (deviation < 0.3) return 'var(--status-warn)'
  return 'var(--status-bad)'
}

function formatAction(action: StageAction): string {
  const corner = t(action.label)
  if (action.kind === 'belt') {
    const dir = action.direction === 'up' ? t('neo_ui.visual.belt.up') : t('neo_ui.visual.belt.down')
    return `${corner}: ${dir}, ${action.teeth}T`
  }
  if (action.kind === 'screw') {
    let isClockwise = action.direction === 'clockwise'
    if (settingsStore.settings.hardware.screw_mode === 'hold_screw') isClockwise = !isClockwise
    const dir = isClockwise ? t('neo_ui.visual.screw.clockwise') : t('neo_ui.visual.screw.counterclockwise')
    const mins = Math.round(action.minutes ?? 0)
    const degs = Math.round(action.degrees ?? 0)
    return `${corner}: ${dir}, ${mins}' (${degs}°)`
  }
  if (action.kind === 'tape') {
    const layers = (action.metadata?.layers as number) ?? 1
    return `${corner}: ${t('neo_ui.visual.tape.layers_short', { value: layers })}`
  }
  return `${corner}: ${action.kind}`
}

function improvementPct(stage: StageResult): string {
  if (stage.baseline === null || stage.baseline === 0) return ''
  const pct = ((stage.baseline - stage.deviation) / stage.baseline) * 100
  if (pct <= 0) return ''
  return `\u2193${pct.toFixed(0)}%`
}

const actionableStages = computed(() => {
  return props.workflow.stages.filter(s => s.key !== 'initial' && s.key !== 'after_temperature')
})

/** The first stage that has actions — this is where the user should start */
const firstActionableKey = computed(() => {
  const stage = actionableStages.value.find(s => s.actions.length > 0)
  return stage?.key ?? null
})

function toggleStage(stage: StageResult) {
  if (expandedStageKey.value === stage.key) {
    expandedStageKey.value = null
  } else {
    expandedStageKey.value = stage.key
    emit('selectStage', stage)
  }
}
</script>

<template>
  <div class="workflow-panel">
    <!-- Compact summary line -->
    <div class="wf-summary">
      <span class="wf-label">{{ t('neo_ui.visual.deviation') }}</span>
      <span class="wf-val" :style="{ color: deviationColor(workflow.stages[0].deviation) }">
        {{ workflow.stages[0].deviation.toFixed(3) }}
      </span>
      <span class="wf-arrow">&rarr;</span>
      <span class="wf-val" :style="{ color: deviationColor(workflow.bestStage.deviation) }">
        {{ workflow.bestStage.deviation.toFixed(3) }} mm
      </span>
    </div>

    <!-- Compact step chips -->
    <div class="wf-steps">
      <div
        v-for="(stage, idx) in actionableStages"
        :key="stage.key"
        class="wf-step"
        :class="{
          'wf-step--current': stage.key === firstActionableKey,
          'wf-step--expanded': expandedStageKey === stage.key,
          'wf-step--no-actions': stage.actions.length === 0,
        }"
        @click="toggleStage(stage)"
      >
        <div class="wf-step-header">
          <span class="wf-step-num" :class="{ 'wf-step-num--current': stage.key === firstActionableKey }">{{ idx + 1 }}</span>
          <span class="wf-step-name">{{ t(stage.label) }}</span>
          <span class="wf-step-dev" :style="{ color: deviationColor(stage.deviation) }">{{ stage.deviation.toFixed(3) }}</span>
          <span v-if="improvementPct(stage)" class="wf-step-pct">{{ improvementPct(stage) }}</span>
        </div>

        <!-- Expanded detail -->
        <div v-if="expandedStageKey === stage.key" class="wf-step-detail">
          <div v-if="stage.actions.length > 0" class="wf-actions">
            <div v-for="(action, i) in stage.actions" :key="i" class="wf-action">
              {{ formatAction(action) }}
            </div>
          </div>
          <div v-else-if="stage.warnings.length > 0" class="wf-note">
            {{ t(stage.warnings[0]) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-panel {
  margin-bottom: 20px;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}

.wf-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
}

.wf-label {
  color: var(--text-muted);
  font-weight: 500;
}

.wf-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.wf-arrow {
  color: var(--text-muted);
}

/* Steps as compact cards stacked vertically */
.wf-steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wf-step {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.wf-step:hover {
  border-color: var(--accent-primary);
}

.wf-step--current {
  border-color: var(--accent-primary);
}

.wf-step--no-actions {
  opacity: 0.6;
}

.wf-step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

.wf-step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-surface);
  border: 1.5px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}

.wf-step-num--current {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.wf-step-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}

.wf-step-dev {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.wf-step-pct {
  font-size: 10px;
  font-weight: 600;
  color: var(--status-good);
}

/* Expanded detail */
.wf-step-detail {
  padding: 0 12px 10px 40px;
}

.wf-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wf-action {
  font-size: 11px;
  color: var(--text-secondary);
}

.wf-action::before {
  content: '\2022  ';
  color: var(--text-muted);
}

.wf-note {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
