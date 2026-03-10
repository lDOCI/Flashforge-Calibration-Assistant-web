<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CalibrationResult } from '@/lib/shaper/types'

const props = defineProps<{
  axis: 'X' | 'Y'
  result: CalibrationResult | null
  allShapers: CalibrationResult[]
  selectedShaper: string
}>()

const emit = defineEmits<{
  selectShaper: [name: string]
}>()

const { t } = useI18n()

function formatAccel(val: number): string {
  return (Math.round(val / 100) * 100).toLocaleString()
}
</script>

<template>
  <div class="axis-info">
    <h4 class="axis-title">{{ t('neo_ui.shaper.axis_label') }} {{ props.axis }}</h4>

    <div v-if="!props.result" class="no-data">
      {{ t('neo_ui.shaper.no_data') }}
    </div>

    <template v-else>
      <div class="recommended">
        <span class="rec-label">{{ t('neo_ui.shaper.recommended') }}:</span>
        <span class="rec-value">{{ props.result.name.toUpperCase() }}</span>
        <span class="rec-freq">@ {{ props.result.freq.toFixed(1) }} Hz</span>
      </div>

      <div class="metrics">
        <div class="metric">
          <span class="metric-label">{{ t('neo_ui.shaper.vibration') }}</span>
          <span class="metric-value">{{ (props.result.vibrs * 100).toFixed(1) }}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">{{ t('neo_ui.shaper.smoothing') }}</span>
          <span class="metric-value">{{ props.result.smoothing.toFixed(3) }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">{{ t('neo_ui.shaper.max_accel') }}</span>
          <span class="metric-value">{{ formatAccel(props.result.maxAccel) }}</span>
        </div>
      </div>

      <div v-if="props.allShapers.length > 0" class="shaper-list">
        <span class="list-label">{{ t('neo_ui.shaper.all_shapers') }}:</span>
        <div class="shaper-chips">
          <button
            v-for="s in props.allShapers"
            :key="s.name"
            class="shaper-chip"
            :class="{ 'shaper-chip--active': s.name === props.selectedShaper }"
            @click="emit('selectShaper', s.name)"
          >
            {{ s.name.toUpperCase() }}
            <span class="chip-freq">{{ s.freq.toFixed(0) }}Hz</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.axis-info {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: 16px;
}

.axis-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.no-data {
  color: var(--text-muted);
  font-size: 13px;
  font-style: italic;
}

.recommended {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 12px;
}

.rec-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.rec-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent-primary);
}

.rec-freq {
  font-size: 13px;
  color: var(--text-muted);
}

.metrics {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.list-label {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 6px;
}

.shaper-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.shaper-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.shaper-chip:hover {
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.shaper-chip--active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.chip-freq {
  font-weight: 400;
  font-size: 10px;
  opacity: 0.8;
}
</style>
