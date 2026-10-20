<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBedStore } from '@/stores/bed'
import { useSettingsStore } from '@/stores/settings'
import { useWizardStore } from '@/stores/wizard'
import { useFileLoader } from '@/composables/useFileLoader'
import { useActionFormat } from '@/composables/useActionFormat'
import { copyShareUrl } from '@/composables/useShareUrl'
import { computeWorkflow } from '@/lib/calibration/workflow'
import { addScaled, gridOf, meanOf, rangeOf, resample } from '@/lib/calibration/grid'
import type { StageKey, StageResult } from '@/lib/calibration/types'
import FileDropZone from '@/components/common/FileDropZone.vue'
import GetMapGuide from '@/components/common/GetMapGuide.vue'
import BedHeatmap from '@/components/bed/BedHeatmap.vue'
import BedSurface3D from '@/components/bed/BedSurface3D.vue'
import ComparePanel from '@/components/bed/ComparePanel.vue'
import BeltDiagram from '@/components/visual/BeltDiagram.vue'
import ScrewDiagram from '@/components/visual/ScrewDiagram.vue'
import TapeDiagram from '@/components/visual/TapeDiagram.vue'

type StepKey = Exclude<StageKey, 'initial'>

const { t } = useI18n()
const bedStore = useBedStore()
const settingsStore = useSettingsStore()
const wizard = useWizardStore()
const { handleDrop, handleDragOver, triggerFileInput } = useFileLoader()
const { formatAction } = useActionFormat()

const ws = computed(() => bedStore.activeWorkspace)
const settings = computed(() => settingsStore.settings)

// ---------- plan for the active measurement ----------

const skipped = computed<StepKey[]>(() => (ws.value ? wizard.skipped[ws.value.id] ?? [] : []))

/** Same engine as the classic view, with skipped steps switched off so later steps plan from reality. */
const workflow = computed(() => {
  if (!ws.value) return null
  const s = settings.value
  const off = (k: StepKey, on: boolean) => on && !skipped.value.includes(k)
  return computeWorkflow(ws.value.meshData, {
    ...s,
    workflow: {
      enable_belt: off('after_belts', s.workflow.enable_belt),
      enable_screws: off('after_screws', s.workflow.enable_screws),
      enable_tape: off('after_tape', s.workflow.enable_tape),
    },
  })
})

const steps = computed(() => workflow.value?.stages.filter(s => s.key !== 'initial') ?? [])
const current = computed(() => steps.value.find(s => s.enabled && s.actions.length > 0) ?? null)
const finalRange = computed(() => steps.value[steps.value.length - 1]?.deviation ?? 0)
const nowRange = computed(() => (ws.value ? rangeOf(ws.value.meshData.matrix) : 0))

type StepStatus = 'current' | 'not_needed' | 'skipped' | 'later' | 'disabled'
function statusOf(step: StageResult): StepStatus {
  if (skipped.value.includes(step.key as StepKey)) return 'skipped'
  if (!step.enabled) return 'disabled'
  if (step === current.value) return 'current'
  if (step.actions.length === 0) return 'not_needed'
  return 'later'
}

const openKey = ref<string | null>(null)
watch(current, c => (openKey.value = c?.key ?? null), { immediate: true })
function toggle(step: StageResult) {
  openKey.value = openKey.value === step.key ? null : step.key
}

/** Tape cells grouped by layer count, thickest first: "4 layers: A1, B2". */
function tapeGroups(step: StageResult) {
  const groups = new Map<number, string[]>()
  const pos = (a: StageResult['actions'][number]) =>
    ((a.metadata.row as number) ?? 0) * 1000 + ((a.metadata.col as number) ?? 0)
  for (const a of [...step.actions].sort((x, y) => pos(x) - pos(y))) {
    const n = (a.metadata.layers as number) ?? 1
    groups.set(n, [...(groups.get(n) ?? []), a.identifier])
  }
  return [...groups.entries()].sort((x, y) => y[0] - x[0]).map(([layers, cells]) => ({ layers, cells }))
}

// ---------- share ----------

const shareStatus = ref('')
async function onShare() {
  try {
    await copyShareUrl()
    shareStatus.value = t('neo_ui.bed.share_copied')
  } catch (e) {
    shareStatus.value = e instanceof Error ? e.message : String(e)
  }
  setTimeout(() => (shareStatus.value = ''), 3000)
}

// ---------- verdict ----------

function verdict(range: number): 'great' | 'good' | 'fair' | 'bad' {
  if (range <= 0.1) return 'great'
  if (range <= 0.2) return 'good'
  if (range <= 0.5) return 'fair'
  return 'bad'
}

// ---------- charts ----------

function centered(m: number[][]): number[][] {
  const mu = meanOf(m)
  return m.map(row => row.map(v => v - mu))
}

const colorRange = computed((): [number, number] | undefined => {
  const m = ws.value?.meshData.matrix
  if (!m) return undefined
  const peak = Math.max(...centered(m).flat().map(Math.abs), 0.01)
  return [-peak, peak]
})

const nowMesh = computed(() => (ws.value ? centered(ws.value.meshData.matrix) : []))

// ---------- measure → act → re-measure ----------

function measureAgain(step: StageResult) {
  if (!ws.value) return
  wizard.expect({
    fromId: ws.value.id,
    stageKey: step.key as StepKey,
    predicted: step.mesh,
    predictedRange: step.deviation,
  })
  triggerFileInput('.cfg,.conf')
}

watch(
  () => bedStore.workspaces.map(w => w.id),
  (ids, old) => {
    const added = ids.find(id => !(old ?? []).includes(id))
    if (added) wizard.attachTo(added)
  },
)

/** Prediction vs reality for the active measurement, if it followed a wizard step. */
const check = computed(() => {
  if (!ws.value) return null
  const c = wizard.checks[ws.value.id]
  const from = bedStore.workspaces.find(w => w.id === c?.fromId)
  if (!c || !from) return null

  const g = settings.value.geometry
  const gFrom = gridOf(from.meshData, g.bed_size_x, g.bed_size_y)
  const gNow = gridOf(ws.value.meshData, g.bed_size_x, g.bed_size_y)
  const predictedOnNow = resample(gFrom, c.predicted, gNow)
  // Z offset differs between measurements; compare shapes, not absolute heights.
  const miss = centered(addScaled(centered(ws.value.meshData.matrix), centered(predictedOnNow), -1))
  return {
    stage: t(steps.value.find(s => s.key === c.stageKey)?.description ?? c.stageKey),
    predicted: c.predictedRange,
    actual: nowRange.value,
    miss,
    missRange: rangeOf(miss),
  }
})

// ---------- attempts ----------

const attempts = computed(() =>
  bedStore.workspaces.map((w, i) => ({
    id: w.id,
    index: i,
    label: `${t('neo_ui.wizard.attempt', { n: i + 1 })} · ${new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    name: w.name,
    range: rangeOf(w.meshData.matrix),
  })),
)
const maxAttemptRange = computed(() => Math.max(...attempts.value.map(a => a.range), 0.01))
</script>

<template>
  <div class="wizard" @drop="handleDrop" @dragover="handleDragOver">
    <div class="wz-head">
      <h1>{{ t('neo_ui.wizard.title') }}</h1>
      <div v-if="bedStore.hasData" class="wz-head-actions">
        <span v-if="shareStatus" class="wz-share-status">{{ shareStatus }}</span>
        <button class="btn-ghost" @click="onShare">{{ t('neo_ui.bed.share') }}</button>
        <button class="btn-ghost" @click="triggerFileInput('.cfg,.conf')">{{ t('neo_ui.wizard.load') }}</button>
      </div>
    </div>

    <template v-if="!bedStore.hasData">
      <FileDropZone :label="t('neo_ui.bed.status.load_hint')" accept=".cfg,.conf" compact />
      <GetMapGuide start-open />
    </template>

    <template v-else-if="ws && workflow">
      <!-- Attempts history -->
      <div class="wz-attempts">
        <div
          v-for="a in attempts"
          :key="a.id"
          class="wz-attempt"
          :class="{ 'wz-attempt--active': a.index === bedStore.activeIndex }"
        >
          <button class="wz-attempt-pick" :title="a.name" @click="bedStore.setActive(a.index)">
            <span class="wz-bar"><span :class="'v--' + verdict(a.range)" :style="{ height: (a.range / maxAttemptRange) * 100 + '%' }"></span></span>
            <span class="wz-attempt-text">
              <span>{{ a.label }}</span>
              <b>{{ a.range.toFixed(2) }} {{ t('neo_ui.units.mm') }}</b>
            </span>
          </button>
          <button class="wz-del" :title="t('neo_ui.wizard.remove')" :aria-label="t('neo_ui.wizard.remove')" @click="bedStore.removeWorkspace(a.index)">×</button>
        </div>
      </div>

      <!-- Status -->
      <div class="wz-status" :class="'v--border-' + verdict(nowRange)">
        <div class="wz-now">
          <span class="wz-big">{{ nowRange.toFixed(2) }}</span>
          <span class="wz-unit">{{ t('neo_ui.units.mm') }}</span>
          <span class="wz-pill" :class="'v--' + verdict(nowRange)">{{ t(`neo_ui.wizard.verdict.${verdict(nowRange)}`) }}</span>
        </div>
        <div class="wz-sub">
          <span>{{ t('neo_ui.wizard.range_hint') }}</span>
          <span v-if="current">
            {{ t('neo_ui.wizard.forecast', { value: finalRange.toFixed(2) }) }}
          </span>
        </div>
      </div>

      <!-- Prediction vs reality -->
      <div v-if="check" class="wz-check">
        <div class="wz-check-text">
          <b>{{ t('neo_ui.wizard.check_title', { stage: check.stage }) }}</b>
          <span>
            {{ t('neo_ui.wizard.check_line', { predicted: check.predicted.toFixed(2), actual: check.actual.toFixed(2) }) }}
          </span>
          <span class="wz-muted">
            {{ check.missRange <= 0.1 ? t('neo_ui.wizard.check_ok') : t('neo_ui.wizard.check_off', { value: check.missRange.toFixed(2) }) }}
          </span>
        </div>
      </div>

      <!-- Current bed -->
      <div class="wz-charts">
        <BedHeatmap :key="'n-' + ws.id" :mesh="nowMesh" :range="colorRange" :title="t('neo_ui.wizard.now')" compact :height="400" />
        <BedSurface3D
          :key="'s-' + ws.id"
          :mesh="nowMesh"
          :range="colorRange"
          :interpolation-points="settings.visualization.interpolation_factor"
          compact
          :height="400"
        />
      </div>

      <!-- Steps -->
      <div v-if="!current" class="wz-done">
        <b>{{ t('neo_ui.wizard.done_title') }}</b>
        <span>{{ t('neo_ui.wizard.done_text') }}</span>
      </div>

      <ol class="wz-steps">
        <li
          v-for="(step, i) in steps"
          :key="step.key"
          class="wz-step"
          :class="['wz-step--' + statusOf(step), { 'wz-step--open': openKey === step.key }]"
        >
          <button class="wz-step-head" @click="toggle(step)">
            <span class="wz-num">{{ i + 1 }}</span>
            <span class="wz-step-name">{{ t(step.description) }}</span>
            <span class="wz-step-status">{{ t(`neo_ui.wizard.status.${statusOf(step)}`) }}</span>
            <span v-if="step.actions.length" class="wz-step-delta">
              {{ (step.baseline ?? 0).toFixed(2) }} → {{ step.deviation.toFixed(2) }}
            </span>
          </button>

          <div v-if="openKey === step.key" class="wz-step-body">
            <p v-if="statusOf(step) === 'later'" class="wz-muted">{{ t('neo_ui.wizard.later_hint') }}</p>
            <p v-if="statusOf(step) === 'skipped'" class="wz-muted">
              {{ t('neo_ui.wizard.skipped_hint') }}
              <button class="btn-link" @click="wizard.unskip(ws.id, step.key as StepKey)">{{ t('neo_ui.wizard.unskip') }}</button>
            </p>

            <template v-if="step.actions.length">
              <ul v-if="step.key === 'after_tape'" class="wz-actions">
                <li v-for="g in tapeGroups(step)" :key="g.layers">
                  <b>{{ t('neo_ui.wizard.tape_layers', { n: g.layers }) }}</b>: {{ g.cells.join(', ') }}
                </li>
                <li v-if="step.metadata.patch_mm" class="wz-muted">
                  {{ t('visual_rec.patch_size', { w: (step.metadata.patch_mm as number[])[0], h: (step.metadata.patch_mm as number[])[1] }) }}
                </li>
              </ul>
              <ul v-else class="wz-actions">
                <li v-for="(a, k) in step.actions" :key="k">{{ formatAction(a) }}</li>
              </ul>
              <p v-for="w in step.warnings" :key="w" class="wz-muted">{{ t(w) }}</p>

              <p v-if="step.key === 'after_belts'" class="wz-muted">{{ t('neo_ui.wizard.belt_view') }}</p>
              <p v-if="step.key === 'after_screws'" class="wz-muted">{{ t('neo_ui.wizard.screws_note') }}</p>
              <div class="wz-diagram">
                <BeltDiagram v-if="step.key === 'after_belts'" :actions="step.actions" />
                <ScrewDiagram
                  v-else-if="step.key === 'after_screws'"
                  :actions="step.actions"
                  :screw-mode="settings.hardware.screw_mode"
                />
                <TapeDiagram
                  v-else
                  :actions="step.actions"
                  :rows="(step.metadata.tape_rows as number) ?? ws.meshData.yCount"
                  :cols="(step.metadata.tape_cols as number) ?? ws.meshData.xCount"
                />
              </div>

              <div class="wz-pair">
                <BedHeatmap :mesh="centered(steps[i - 1]?.mesh ?? ws.meshData.matrix)" :range="colorRange" :title="t('neo_ui.wizard.before_step')" compact :height="340" />
                <BedHeatmap :mesh="centered(step.mesh)" :range="colorRange" :title="t('neo_ui.wizard.after_step')" compact :height="340" />
              </div>

              <div v-if="statusOf(step) === 'current'" class="wz-buttons">
                <button class="btn-primary" @click="measureAgain(step)">{{ t('neo_ui.wizard.did_it') }}</button>
                <button class="btn-ghost" @click="wizard.skip(ws.id, step.key as StepKey)">{{ t('neo_ui.wizard.skip') }}</button>
              </div>
            </template>
            <p v-else-if="step.warnings.length" class="wz-muted">{{ t(step.warnings[0]) }}</p>
          </div>
        </li>
      </ol>

      <p class="wz-muted wz-floor">
        {{ t('visual_rec.flatness_floor', { value: workflow.flatnessFloor.toFixed(2) }) }}
      </p>

      <ComparePanel />
      <GetMapGuide />
    </template>
  </div>
</template>

<style scoped>
.wizard {
  max-width: 1100px;
  margin: 0 auto;
}

.wz-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.wz-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.wz-share-status {
  font-size: 12px;
  color: var(--status-good);
}

.btn-primary,
.btn-ghost {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--accent-primary);
  border: 1px solid var(--accent-primary);
  color: #fff;
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-ghost {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-ghost:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.btn-link {
  background: none;
  border: none;
  color: var(--accent-primary);
  cursor: pointer;
  font-size: inherit;
  padding: 0 4px;
}

.wz-muted {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 4px 0;
}

/* verdict colours */
.v--great { background: var(--status-good); }
.v--good { background: var(--status-ok); }
.v--fair { background: var(--status-warn); }
.v--bad { background: var(--status-bad); }
.v--border-great { border-left-color: var(--status-good) !important; }
.v--border-good { border-left-color: var(--status-ok) !important; }
.v--border-fair { border-left-color: var(--status-warn) !important; }
.v--border-bad { border-left-color: var(--status-bad) !important; }

/* attempts */
.wz-attempts {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 12px;
}

.wz-attempt {
  display: flex;
  align-items: stretch;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.wz-attempt-pick {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 6px 4px 6px 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
}

.wz-del {
  padding: 0 8px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
}

.wz-del:hover {
  color: var(--status-bad);
}

.wz-attempt--active {
  border-color: var(--accent-primary);
}

.wz-bar {
  width: 6px;
  height: 32px;
  background: var(--bg-surface);
  border-radius: 3px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.wz-bar span {
  width: 100%;
  border-radius: 3px;
}

.wz-attempt-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-size: 11px;
  gap: 2px;
}

.wz-attempt-text b {
  font-size: 13px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* status */
.wz-status {
  padding: 14px 18px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-left: 4px solid var(--status-bad);
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.wz-now {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.wz-big {
  font-size: 34px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.wz-unit {
  font-size: 14px;
  color: var(--text-muted);
}

.wz-pill {
  font-size: 11px;
  font-weight: 700;
  color: #111;
  padding: 2px 10px;
  border-radius: 999px;
  align-self: center;
}

.wz-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

/* prediction check */
.wz-check {
  padding: 10px 14px;
  margin-bottom: 12px;
  background: var(--card-bg);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-sm);
}

.wz-check-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  color: var(--text-secondary);
}

.wz-check-text b {
  color: var(--text-primary);
}

/* charts */
.wz-charts,
.wz-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.wz-charts > *,
.wz-pair > * {
  min-width: 0;
}

/* Side by side only when each chart gets enough width to stay readable. */
.wizard {
  container-type: inline-size;
}

@container (max-width: 820px) {
  .wz-charts,
  .wz-pair {
    grid-template-columns: 1fr;
  }
}

/* done */
.wz-done {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 18px;
  margin-bottom: 12px;
  background: var(--card-bg);
  border: 1px solid var(--status-good);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
}

.wz-done b {
  color: var(--text-primary);
}

/* steps */
.wz-steps {
  list-style: none;
  padding: 0;
  margin: 0 0 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wz-step {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
}

.wz-step--current {
  border-color: var(--accent-primary);
}

.wz-step--not_needed,
.wz-step--disabled,
.wz-step--skipped {
  opacity: 0.65;
}

.wz-step-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  flex-wrap: wrap;
}

.wz-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}

.wz-step--current .wz-num {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.wz-step-name {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  min-width: 120px;
}

.wz-step-status {
  font-size: 11px;
  color: var(--text-muted);
}

.wz-step--current .wz-step-status {
  color: var(--accent-primary);
  font-weight: 600;
}

.wz-step-delta {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.wz-step-body {
  padding: 0 14px 14px 46px;
}

@media (max-width: 600px) {
  .wz-step-body {
    padding-left: 14px;
  }
}

.wz-actions {
  margin: 0 0 8px;
  padding-left: 18px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
}

.wz-diagram {
  display: flex;
  justify-content: center;
  margin: 10px 0;
  overflow-x: auto;
}

.wz-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.wz-floor {
  margin-bottom: 8px;
}
</style>
