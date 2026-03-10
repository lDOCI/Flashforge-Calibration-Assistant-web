<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StageAction } from '@/lib/calibration/types'

const props = defineProps<{
  actions: StageAction[]
  screwMode?: string // 'hold_nut' (default) or 'hold_screw'
}>()

const { t } = useI18n()

const COLOR_CW = '#F87171'   // red = tighten
const COLOR_CCW = '#34D399'  // green = loosen

interface CornerInfo {
  id: string
  cx: number
  cy: number
}

const corners: CornerInfo[] = [
  { id: 'front_left',  cx: 80,  cy: 210 },
  { id: 'front_right', cx: 250, cy: 210 },
  { id: 'back_left',   cx: 80,  cy: 70 },
  { id: 'back_right',  cx: 250, cy: 70 },
]

const R = 28 // arc radius

function getAction(id: string): StageAction | undefined {
  return props.actions.find(a => a.identifier === id)
}

/** Get user-facing direction: reversed when hold_screw mode */
function userDirection(action: StageAction): string {
  const actual = action.direction
  if (props.screwMode === 'hold_screw') {
    return actual === 'clockwise' ? 'counterclockwise' : 'clockwise'
  }
  return actual ?? 'clockwise'
}

function cornerColor(corner: CornerInfo): string {
  const action = getAction(corner.id)
  if (!action) return 'var(--text-muted)'
  return userDirection(action) === 'clockwise' ? COLOR_CW : COLOR_CCW
}

// Animation progress 0→1, looping
const progress = ref(0)
let animFrame = 0
let startTime = 0
const ANIM_DURATION = 2500
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

/** SVG arc path for a wedge from startAngle to endAngle (degrees, SVG coords) */
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const sweep = Math.abs(endDeg - startDeg)
  if (sweep >= 360) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
  }
  const startRad = (startDeg * Math.PI) / 180
  const endRad = (endDeg * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = sweep > 180 ? 1 : 0
  const sweepFlag = endDeg > startDeg ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${x2} ${y2} Z`
}

function wedgePath(corner: CornerInfo): string {
  const action = getAction(corner.id)
  if (!action) return ''
  const degrees = Math.abs(action.degrees ?? 0)
  const animated = degrees * progress.value
  const baseDeg = Math.min(animated, 360)
  const dir = userDirection(action)
  const startAngle = -90
  if (dir === 'clockwise') {
    return describeArc(corner.cx, corner.cy, R, startAngle, startAngle + baseDeg)
  } else {
    return describeArc(corner.cx, corner.cy, R, startAngle, startAngle - baseDeg)
  }
}

function overflowPath(corner: CornerInfo): string {
  const action = getAction(corner.id)
  if (!action) return ''
  const degrees = Math.abs(action.degrees ?? 0)
  if (degrees <= 360) return ''
  const animated = degrees * progress.value
  const overflowDeg = animated - 360
  if (overflowDeg <= 0) return ''
  const dir = userDirection(action)
  const startAngle = -90
  if (dir === 'clockwise') {
    return describeArc(corner.cx, corner.cy, R, startAngle, startAngle + Math.min(overflowDeg, 360))
  } else {
    return describeArc(corner.cx, corner.cy, R, startAngle, startAngle - Math.min(overflowDeg, 360))
  }
}

function hasOverflow(corner: CornerInfo): boolean {
  const action = getAction(corner.id)
  if (!action) return false
  return Math.abs(action.degrees ?? 0) > 360
}

function cornerLabel(corner: CornerInfo): string {
  const action = getAction(corner.id)
  if (!action) return 'OK'
  const mins = Math.round(action.minutes ?? 0)
  const degs = Math.round(action.degrees ?? 0)
  return `${mins}' (${degs}°)`
}
</script>

<template>
  <div class="screw-diagram">
    <div class="diagram-subtitle">{{ t('visual_rec.top_view') }}</div>

    <svg viewBox="0 0 330 290" class="diagram-svg">
      <!-- Bed outline -->
      <rect x="40" y="40" width="250" height="210" rx="10"
        fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1.5" opacity="0.5" />

      <!-- Front / Back labels -->
      <text x="165" y="28" text-anchor="middle" fill="var(--text-muted)" font-size="11">
        {{ t('visual_rec.back_label') }}
      </text>
      <text x="165" y="272" text-anchor="middle" fill="var(--text-muted)" font-size="11">
        {{ t('visual_rec.front_label') }}
      </text>

      <!-- Each corner -->
      <g v-for="corner in corners" :key="corner.id">
        <!-- Background circle (screw head) -->
        <circle
          :cx="corner.cx" :cy="corner.cy" :r="R"
          fill="none"
          stroke="var(--border-color)"
          stroke-width="1"
          opacity="0.4"
        />

        <!-- Animated wedge fill (base, up to 360°) -->
        <path
          v-if="getAction(corner.id)"
          :d="wedgePath(corner)"
          :fill="cornerColor(corner)"
          opacity="0.4"
        />

        <!-- Overflow wedge (>360°, darker shade) -->
        <path
          v-if="hasOverflow(corner)"
          :d="overflowPath(corner)"
          :fill="cornerColor(corner)"
          opacity="0.75"
        />

        <!-- Center dot -->
        <circle
          :cx="corner.cx" :cy="corner.cy" r="4"
          :fill="cornerColor(corner)"
        />

        <!-- Cross lines on screw head -->
        <line :x1="corner.cx - 2" :y1="corner.cy" :x2="corner.cx + 2" :y2="corner.cy"
          stroke="var(--bg-surface)" stroke-width="1.5" />
        <line :x1="corner.cx" :y1="corner.cy - 2" :x2="corner.cx" :y2="corner.cy + 2"
          stroke="var(--bg-surface)" stroke-width="1.5" />

        <!-- Minutes/degrees label -->
        <text
          :x="corner.cx"
          :y="corner.cy + R + 16"
          text-anchor="middle"
          :fill="getAction(corner.id) ? 'var(--text-primary)' : 'var(--status-good)'"
          font-size="12"
          font-weight="600"
        >{{ cornerLabel(corner) }}</text>

        <!-- Corner name -->
        <text
          :x="corner.cx"
          :y="corner.cy - R - 8"
          text-anchor="middle"
          fill="var(--text-secondary)"
          font-size="9"
        >{{ t(`visual_rec.${corner.id}`) }}</text>
      </g>
    </svg>

    <!-- Mini-instruction -->
    <div class="instructions">
      <p>{{ t('neo_ui.visual.screw.instr_intro') }}</p>
      <p class="instr-mode" v-if="screwMode === 'hold_screw'">
        {{ t('neo_ui.visual.screw.instr_hold_screw') }}
      </p>
      <p class="instr-mode" v-else>
        {{ t('neo_ui.visual.screw.instr_hold_nut') }}
      </p>
      <p class="instr-hint">{{ t('neo_ui.visual.screw.instr_direction') }}</p>
      <p class="instr-hint">{{ t('neo_ui.visual.screw.instr_after') }}</p>
    </div>
  </div>
</template>

<style scoped>
.screw-diagram {
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
  padding: 8px 12px;
  background: var(--bg-surface);
  border-left: 3px solid var(--accent-primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  text-align: left;
}

.instructions p {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 4px;
}

.instructions p:last-child {
  margin-bottom: 0;
}

.instr-mode {
  font-weight: 600;
  color: var(--text-primary) !important;
}

.instr-hint {
  font-size: 11px !important;
  color: var(--text-muted) !important;
}
</style>
