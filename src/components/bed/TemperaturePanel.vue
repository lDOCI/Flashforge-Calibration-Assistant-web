<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useBedStore } from '@/stores/bed'
import BedHeatmap from './BedHeatmap.vue'
import type { StageResult } from '@/lib/calibration/types'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const bedStore = useBedStore()

const expanded = ref(false)

interface ThermalPreset {
  name: string
  measurement_temp: number
  target_temp: number
  chamber_factor: number
  pei_thickness: number
  steel_thickness: number
  alpha_pei: number
  alpha_steel: number
  beta_uniform: number
}

const defaultPresets: ThermalPreset[] = [
  { name: 'PLA 50°C', measurement_temp: 60, target_temp: 50, chamber_factor: 0.25, pei_thickness: 0.55, steel_thickness: 1.50, alpha_pei: 5.0e-5, alpha_steel: 1.2e-5, beta_uniform: 0.2 },
  { name: 'PETG 70°C', measurement_temp: 60, target_temp: 70, chamber_factor: 0.30, pei_thickness: 0.55, steel_thickness: 1.50, alpha_pei: 5.0e-5, alpha_steel: 1.2e-5, beta_uniform: 0.2 },
  { name: 'ABS 100°C', measurement_temp: 60, target_temp: 100, chamber_factor: 0.40, pei_thickness: 0.55, steel_thickness: 1.50, alpha_pei: 5.0e-5, alpha_steel: 1.2e-5, beta_uniform: 0.2 },
]

const activePresetIdx = ref(0)
const activePreset = computed(() => defaultPresets[activePresetIdx.value])

// Find temperature stage from workflow
const tempStage = computed((): StageResult | null => {
  const ws = bedStore.activeWorkspace
  if (!ws?.workflow) return null
  return ws.workflow.stages.find(s => s.key === 'after_temperature') ?? null
})

// Compute thermal warp mesh by applying preset to current bed
const warpMesh = computed(() => {
  if (!tempStage.value) return null
  return tempStage.value.mesh
})

const meta = computed(() => {
  if (!tempStage.value?.metadata) return null
  return tempStage.value.metadata as Record<string, number>
})

// Apply preset to settings and recompute
function selectPreset(idx: number) {
  activePresetIdx.value = idx
  const p = defaultPresets[idx]
  const env = settingsStore.settings.environment
  env.measurement_temp = p.measurement_temp
  env.target_temp = p.target_temp

  // Set thermal model
  settingsStore.settings.thermal_model = {
    chamber_factor: p.chamber_factor,
    pei_thickness: p.pei_thickness,
    steel_thickness: p.steel_thickness,
    alpha_pei: p.alpha_pei,
    alpha_steel: p.alpha_steel,
    beta_uniform: p.beta_uniform,
  }

  bedStore.recomputeAllWorkflows()
}

function formatSci(val: number | undefined): string {
  if (val === undefined) return '—'
  return val.toExponential(2)
}
</script>

<template>
  <div class="temp-panel">
    <div class="temp-header" @click="expanded = !expanded">
      <span class="temp-title">{{ t('visual_rec.stage_temperature') }}</span>
      <span class="temp-chevron">{{ expanded ? '▾' : '▸' }}</span>
    </div>

    <div v-if="expanded" class="temp-body">
      <p class="temp-desc">{{ t('settings_tab.environment_info') }}</p>

      <!-- Preset selector -->
      <div class="preset-row">
        <button
          v-for="(preset, idx) in defaultPresets"
          :key="preset.name"
          class="preset-chip"
          :class="{ 'preset-chip--active': idx === activePresetIdx }"
          @click="selectPreset(idx)"
        >
          {{ preset.name }}
        </button>
      </div>

      <!-- Preset info -->
      <div v-if="activePreset" class="preset-info">
        <div class="info-row">
          <span class="info-label">{{ t('settings_tab.measurement_temp') }}</span>
          <span class="info-value">{{ activePreset.measurement_temp }}°C</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ t('settings_tab.target_temp') }}</span>
          <span class="info-value">{{ activePreset.target_temp }}°C</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ t('settings_tab.chamber_factor') }}</span>
          <span class="info-value">{{ activePreset.chamber_factor }}</span>
        </div>
      </div>

      <!-- Thermal metadata -->
      <div v-if="meta" class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">κ total</span>
          <span class="meta-value">{{ formatSci(meta.kappa_total) }} 1/mm</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Warp range</span>
          <span class="meta-value">±{{ (meta.warp_range / 2).toFixed(3) }} mm</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">κ bimetal</span>
          <span class="meta-value">{{ formatSci(meta.kappa_bimetal) }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">κ uniform</span>
          <span class="meta-value">{{ formatSci(meta.kappa_uniform) }}</span>
        </div>
      </div>

      <!-- Warp heatmap -->
      <div v-if="warpMesh && warpMesh.length > 0" class="temp-chart">
        <BedHeatmap
          :mesh="warpMesh"
          :title="`${activePreset.measurement_temp}°C → ${activePreset.target_temp}°C`"
        />
      </div>

      <div v-else class="temp-empty">
        {{ t('visual_rec.temperature_no_adjustments') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.temp-panel {
  margin-top: 12px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.temp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.temp-header:hover {
  background: var(--bg-hover);
}

.temp-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex: 1;
}

.temp-chevron {
  color: var(--text-muted);
  font-size: 10px;
}

.temp-body {
  padding: 0 14px 14px;
}

.temp-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 10px;
  white-space: pre-line;
  line-height: 1.5;
}

.preset-row {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.preset-chip {
  padding: 3px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.preset-chip:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.preset-chip--active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.preset-info {
  display: flex;
  gap: 14px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.info-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.info-label {
  font-size: 10px;
  color: var(--text-muted);
}

.info-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 4px;
  margin-bottom: 10px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 8px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
}

.meta-label {
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.meta-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.temp-chart {
  max-width: 500px;
}

.temp-empty {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  padding: 8px 0;
}
</style>
