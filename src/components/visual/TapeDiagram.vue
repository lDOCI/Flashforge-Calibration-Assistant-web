<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StageAction } from '@/lib/calibration/types'

const props = defineProps<{
  actions: StageAction[]
  rows: number
  cols: number
}>()

const { t } = useI18n()

// Build grid of tape layers
const grid = computed(() => {
  const g: (number | null)[][] = Array.from({ length: props.rows }, () =>
    Array(props.cols).fill(null),
  )

  for (const action of props.actions) {
    // Parse position like "2B" → row=1, col=1
    const match = action.identifier.match(/^(\d+)([A-Z])$/)
    if (!match) continue
    const row = parseInt(match[1]) - 1
    const col = match[2].charCodeAt(0) - 65
    if (row >= 0 && row < props.rows && col >= 0 && col < props.cols) {
      g[row][col] = (action.metadata?.layers as number) ?? 1
    }
  }

  return g
})

// Column labels: A-Z for ≤26, then numbers for larger grids
const colLabels = computed(() => {
  if (props.cols <= 26) {
    return Array.from({ length: props.cols }, (_, i) => String.fromCharCode(65 + i))
  }
  return Array.from({ length: props.cols }, (_, i) => String(i + 1))
})

// For large grids, shrink cells
const isLargeGrid = computed(() => props.cols > 12 || props.rows > 12)

function cellColor(layers: number | null): string {
  if (layers === null) return 'transparent'
  if (layers <= 1) return 'var(--tape-1)'
  if (layers <= 2) return 'var(--tape-2)'
  return 'var(--tape-3)'
}
</script>

<template>
  <div class="tape-diagram">
    <div class="tape-grid-wrapper" :class="{ 'tape-grid-wrapper--large': isLargeGrid }">
      <!-- Column headers -->
      <div
        class="col-headers"
        :style="{ gridTemplateColumns: `28px repeat(${cols}, 1fr)` }"
      >
        <div></div>
        <div
          v-for="(label, ci) in colLabels"
          :key="ci"
          class="grid-label"
          :class="{ 'grid-label--small': isLargeGrid }"
        >{{ label }}</div>
      </div>

      <!-- Grid with row headers -->
      <div
        class="grid-body"
        :style="{ gridTemplateColumns: `28px repeat(${cols}, 1fr)` }"
      >
        <template v-for="(row, ri) in grid" :key="ri">
          <!-- Row number -->
          <div class="grid-label row-label" :class="{ 'grid-label--small': isLargeGrid }">{{ ri + 1 }}</div>
          <!-- Cells -->
          <div
            v-for="(cell, ci) in row"
            :key="`${ri}-${ci}`"
            class="tape-cell"
            :class="{ 'tape-cell--small': isLargeGrid }"
            :style="{ background: cellColor(cell) }"
            :title="`${ri + 1}${colLabels[ci]}`"
          >
            <span v-if="cell !== null" class="tape-layers" :class="{ 'tape-layers--small': isLargeGrid }">{{ cell }}</span>
          </div>
        </template>
      </div>
    </div>
    <div v-if="actions.length === 0" class="no-tape">{{ t('visual_rec.tape_correction_not_needed') }}</div>

    <!-- Mini-instruction -->
    <div v-if="actions.length > 0" class="instructions">
      <ol>
        <li>{{ t('neo_ui.visual.tape.instr_1') }}</li>
        <li>{{ t('neo_ui.visual.tape.instr_2') }}</li>
        <li>{{ t('neo_ui.visual.tape.instr_3') }}</li>
        <li>{{ t('neo_ui.visual.tape.instr_4') }}</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.tape-diagram {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: 12px;
  overflow-x: auto;
}

.tape-grid-wrapper {
  min-width: 200px;
  max-width: 420px;
  margin: 0 auto;
}

.tape-grid-wrapper--large {
  max-width: 100%;
  min-width: unset;
}

.col-headers {
  display: grid;
  gap: 2px;
  margin-bottom: 1px;
}

.grid-body {
  display: grid;
  gap: 2px;
}

.grid-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.grid-label--small {
  font-size: 7px;
}

.row-label {
  justify-content: flex-end;
  padding-right: 3px;
}

.tape-cell {
  aspect-ratio: 1;
  min-width: 28px;
  min-height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tape-cell--small {
  aspect-ratio: unset;
  min-width: 14px;
  min-height: 14px;
}

.tape-layers {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}

.tape-layers--small {
  font-size: 9px;
}

.no-tape {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
  padding: 8px;
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
