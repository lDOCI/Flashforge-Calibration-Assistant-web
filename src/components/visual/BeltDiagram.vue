<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StageAction } from '@/lib/calibration/types'

const props = defineProps<{
  actions: StageAction[]
}>()

const { t } = useI18n()

interface ShaftInfo {
  id: string
  cx: number
  cy: number
}

const shafts: ShaftInfo[] = [
  { id: 'front_left',  cx: 80,  cy: 185 },
  { id: 'front_right', cx: 250, cy: 185 },
  { id: 'back',        cx: 165, cy: 65 },
]

// Gear geometry (GT2 20T pulley)
const TEETH = 20
const OUTER_R = 22
const INNER_R = 16
const DEG_PER_TOOTH = 360 / TEETH // 18°
const MM_PER_TOOTH = 0.4

// Precompute gear polygon path centered at origin
const gearPathD = (() => {
  const step = (2 * Math.PI) / TEETH
  const toothHalf = step * 0.28
  const pts: string[] = []
  for (let i = 0; i < TEETH; i++) {
    const a = i * step - Math.PI / 2
    const a1 = a - toothHalf
    const a2 = a + toothHalf
    pts.push(
      `${(INNER_R * Math.cos(a1)).toFixed(1)},${(INNER_R * Math.sin(a1)).toFixed(1)}`,
      `${(OUTER_R * Math.cos(a1)).toFixed(1)},${(OUTER_R * Math.sin(a1)).toFixed(1)}`,
      `${(OUTER_R * Math.cos(a2)).toFixed(1)},${(OUTER_R * Math.sin(a2)).toFixed(1)}`,
      `${(INNER_R * Math.cos(a2)).toFixed(1)},${(INNER_R * Math.sin(a2)).toFixed(1)}`,
    )
  }
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`
})()

function getAction(id: string): StageAction | undefined {
  return props.actions.find(a => a.identifier === id)
}

function shaftColor(shaft: ShaftInfo): string {
  const action = getAction(shaft.id)
  if (!action) return 'var(--text-muted)'
  return action.direction === 'up' ? '#34D399' : '#F87171'
}

// Animation
const progress = ref(0)
let animFrame = 0
let startTime = 0
const ANIM_DURATION = 2000
const PAUSE_DURATION = 1200

function animate(ts: number) {
  if (!startTime) startTime = ts
  const elapsed = (ts - startTime) % (ANIM_DURATION + PAUSE_DURATION)
  progress.value = elapsed < ANIM_DURATION
    ? Math.min(elapsed / ANIM_DURATION, 1)
    : 1
  animFrame = requestAnimationFrame(animate)
}

onMounted(() => { animFrame = requestAnimationFrame(animate) })
onUnmounted(() => cancelAnimationFrame(animFrame))

/** Exact gear rotation: teeth × 18° per tooth, no clamping */
function gearRotation(shaft: ShaftInfo): number {
  const action = getAction(shaft.id)
  if (!action) return 0
  const cw = action.direction !== 'up'
  const teeth = action.teeth ?? 1
  const totalDeg = teeth * DEG_PER_TOOTH
  const angle = totalDeg * progress.value
  return cw ? angle : -angle
}

function teethText(shaft: ShaftInfo): string {
  const action = getAction(shaft.id)
  if (!action) return 'OK'
  const teeth = action.teeth ?? 0
  const mm = (teeth * MM_PER_TOOTH).toFixed(1)
  return t('neo_ui.visual.belt.teeth_with_mm', { count: teeth, mm })
}

function directionText(shaft: ShaftInfo): string {
  const action = getAction(shaft.id)
  if (!action) return ''
  return action.direction === 'up'
    ? t('neo_ui.visual.belt.direction.up')
    : t('neo_ui.visual.belt.direction.down')
}
</script>

<template>
  <div class="belt-diagram">
    <div class="diagram-subtitle">{{ t('visual_rec.top_view') }}</div>

    <svg viewBox="0 0 330 290" class="diagram-svg">
      <!-- Bed outline -->
      <rect x="45" y="40" width="240" height="180" rx="10"
        fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1.5" opacity="0.5" />

      <!-- Belt path (triangle connecting shafts) -->
      <path d="M 80 185 L 165 65 L 250 185 Z"
        fill="none" stroke="var(--text-muted)" stroke-width="1.5"
        stroke-dasharray="6 3" opacity="0.35" />

      <!-- Orientation labels -->
      <text x="165" y="14" text-anchor="middle" fill="var(--text-muted)" font-size="10">
        {{ t('visual_rec.back_label') }}
      </text>
      <text x="165" y="258" text-anchor="middle" fill="var(--text-muted)" font-size="10">
        {{ t('visual_rec.front_label') }}
      </text>

      <!-- Info: 1 tooth = 0.4 mm -->
      <text x="165" y="278" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-style="italic">
        {{ t('neo_ui.visual.belt.tooth_info') }}
      </text>

      <!-- Each shaft: name above, gear, teeth+direction below -->
      <g v-for="shaft in shafts" :key="shaft.id">
        <!-- Shaft name (above gear) -->
        <text
          :x="shaft.cx"
          :y="shaft.cy - OUTER_R - 6"
          text-anchor="middle"
          fill="var(--text-secondary)"
          font-size="9"
        >{{ shaft.id === 'back' ? t('visual_rec.back_center') : t(`visual_rec.${shaft.id}`) }}</text>

        <!-- Animated rotating gear -->
        <g :transform="`translate(${shaft.cx},${shaft.cy}) rotate(${gearRotation(shaft)})`">
          <path
            :d="gearPathD"
            fill="var(--bg-surface)"
            :stroke="shaftColor(shaft)"
            stroke-width="1.5"
            stroke-linejoin="round"
            :opacity="getAction(shaft.id) ? 1 : 0.4"
          />
        </g>

        <!-- Center bore (static) -->
        <circle
          :cx="shaft.cx" :cy="shaft.cy" r="5"
          fill="var(--card-bg)"
          :stroke="shaftColor(shaft)"
          stroke-width="1"
          :opacity="getAction(shaft.id) ? 1 : 0.4"
        />
        <circle :cx="shaft.cx" :cy="shaft.cy" r="1.5" :fill="shaftColor(shaft)" />

        <!-- Teeth count + mm (below gear) -->
        <text
          :x="shaft.cx"
          :y="shaft.cy + OUTER_R + 14"
          text-anchor="middle"
          :fill="getAction(shaft.id) ? 'var(--text-primary)' : 'var(--status-good)'"
          font-size="11"
          font-weight="700"
        >{{ teethText(shaft) }}</text>

        <!-- Direction label (below teeth) -->
        <text
          :x="shaft.cx"
          :y="shaft.cy + OUTER_R + 26"
          text-anchor="middle"
          :fill="shaftColor(shaft)"
          font-size="9"
        >{{ directionText(shaft) }}</text>
      </g>
    </svg>

    <!-- Mini-instruction -->
    <div class="instructions">
      <ol>
        <li>{{ t('neo_ui.visual.belt.instr_1') }}</li>
        <li>{{ t('neo_ui.visual.belt.instr_2') }}</li>
        <li>{{ t('neo_ui.visual.belt.instr_3') }}</li>
        <li>{{ t('neo_ui.visual.belt.instr_4') }}</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.belt-diagram {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: 12px;
  text-align: center;
}

.diagram-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.diagram-svg {
  width: 100%;
  max-width: 330px;
  margin: 0 auto;
  display: block;
}

.instructions {
  margin-top: 10px;
  padding: 8px 12px 8px 8px;
  background: var(--bg-surface);
  border-left: 3px solid var(--accent-primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  text-align: left;
}

.instructions ol {
  margin: 0;
  padding-left: 18px;
}

.instructions li {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}
</style>
