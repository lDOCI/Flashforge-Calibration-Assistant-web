<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useBedStore } from '@/stores/bed'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const bedStore = useBedStore()
const s = settingsStore.settings

interface PrinterPreset {
  id: string
  name: string
  screw_pitch: number
  screw_mode: 'hold_nut' | 'hold_screw'
  belt_tooth_mm: number
  tape_thickness: number
}

const printerPresets: PrinterPreset[] = [
  { id: 'ad5m', name: 'Flashforge AD5M', screw_pitch: 0.7, screw_mode: 'hold_nut', belt_tooth_mm: 0.4, tape_thickness: 0.06 },
  { id: 'ad5x', name: 'Flashforge AD5X', screw_pitch: 0.7, screw_mode: 'hold_screw', belt_tooth_mm: 0.4, tape_thickness: 0.06 },
  { id: 'custom', name: t('neo_ui.settings.printer.custom'), screw_pitch: s.hardware.screw_pitch, screw_mode: s.hardware.screw_mode, belt_tooth_mm: s.hardware.belt_tooth_mm, tape_thickness: s.hardware.tape_thickness },
]

const activePreset = ref(
  s.hardware.screw_mode === 'hold_screw' ? 'ad5x' : 'ad5m'
)

function applyPreset(presetId: string) {
  activePreset.value = presetId
  const preset = printerPresets.find(p => p.id === presetId)
  if (preset && presetId !== 'custom') {
    s.hardware.screw_pitch = preset.screw_pitch
    s.hardware.screw_mode = preset.screw_mode
    s.hardware.belt_tooth_mm = preset.belt_tooth_mm
    s.hardware.tape_thickness = preset.tape_thickness
    bedStore.recomputeAllWorkflows()
  }
}

function onSettingsChange() {
  activePreset.value = 'custom'
  bedStore.recomputeAllWorkflows()
}

function onPresetSettingsChange() {
  bedStore.recomputeAllWorkflows()
}

function resetAll() {
  if (confirm(t('neo_ui.settings.confirm_reset'))) {
    settingsStore.reset()
    activePreset.value = 'ad5m'
    bedStore.recomputeAllWorkflows()
  }
}
</script>

<template>
  <div class="settings-view">
    <h1>{{ t('neo_ui.settings.header') }}</h1>

    <!-- Printer preset -->
    <section class="settings-section">
      <h2>{{ t('neo_ui.settings.printer.title') }}</h2>
      <div class="preset-row">
        <button
          v-for="preset in printerPresets"
          :key="preset.id"
          class="preset-btn"
          :class="{ 'preset-btn--active': activePreset === preset.id }"
          @click="applyPreset(preset.id)"
        >
          {{ preset.name }}
        </button>
      </div>
      <p v-if="activePreset === 'ad5x'" class="preset-hint">
        {{ t('neo_ui.settings.printer.ad5x_hint') }}
      </p>
    </section>

    <!-- Hardware -->
    <section class="settings-section">
      <h2>{{ t('neo_ui.settings.hardware.title') }}</h2>
      <div class="field-grid">
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.hardware.screw_pitch') }}</span>
          <input type="number" v-model.number="s.hardware.screw_pitch" step="0.1" min="0.1" @change="onSettingsChange" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.hardware.tape_thickness') }}</span>
          <input type="number" v-model.number="s.hardware.tape_thickness" step="0.01" min="0.01" @change="onSettingsChange" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.hardware.belt_tooth') }}</span>
          <input type="number" v-model.number="s.hardware.belt_tooth_mm" step="0.1" min="0.1" @change="onSettingsChange" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.hardware.corner_avg') }}</span>
          <input type="number" v-model.number="s.hardware.corner_averaging" step="1" min="0" @change="onPresetSettingsChange" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.hardware.screw_mode') }}</span>
          <select v-model="s.hardware.screw_mode" @change="onSettingsChange">
            <option value="hold_nut">{{ t('neo_ui.settings.hardware.hold_nut') }}</option>
            <option value="hold_screw">{{ t('neo_ui.settings.hardware.hold_screw') }}</option>
          </select>
        </label>
      </div>
    </section>

    <!-- Thresholds -->
    <section class="settings-section">
      <h2>{{ t('neo_ui.settings.thresholds.title') }}</h2>
      <div class="field-grid">
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.thresholds.belt') }}</span>
          <input type="number" v-model.number="s.thresholds.belt_threshold" step="0.01" min="0" @change="onSettingsChange" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.thresholds.screw') }}</span>
          <input type="number" v-model.number="s.thresholds.screw_threshold" step="0.01" min="0" @change="onSettingsChange" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.thresholds.tape') }}</span>
          <input type="number" v-model.number="s.thresholds.tape_threshold" step="0.001" min="0" @change="onSettingsChange" />
        </label>
      </div>
    </section>

    <!-- Workflow toggles -->
    <section class="settings-section">
      <h2>{{ t('neo_ui.settings.workflow.title') }}</h2>
      <div class="field-grid">
        <label class="field field--toggle">
          <input type="checkbox" v-model="s.workflow.enable_belt" @change="onSettingsChange" />
          <span class="field-label">{{ t('neo_ui.settings.workflow.enable_belt') }}</span>
        </label>
        <label class="field field--toggle">
          <input type="checkbox" v-model="s.workflow.enable_screws" @change="onSettingsChange" />
          <span class="field-label">{{ t('neo_ui.settings.workflow.enable_screws') }}</span>
        </label>
        <label class="field field--toggle">
          <input type="checkbox" v-model="s.workflow.enable_tape" @change="onSettingsChange" />
          <span class="field-label">{{ t('neo_ui.settings.workflow.enable_tape') }}</span>
        </label>
      </div>
    </section>

    <!-- Environment -->
    <section class="settings-section">
      <h2>{{ t('neo_ui.settings.environment.title') }}</h2>
      <div class="field-grid">
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.environment.measurement_temp') }}</span>
          <input type="number" v-model.number="s.environment.measurement_temp" step="0.5" @change="onSettingsChange" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.environment.target_temp') }}</span>
          <input type="number" v-model.number="s.environment.target_temp" step="0.5" @change="onSettingsChange" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.environment.thermal_coeff') }}</span>
          <input type="number" v-model.number="s.environment.thermal_expansion_coeff" step="0.0001" @change="onSettingsChange" />
        </label>
      </div>
    </section>

    <!-- Visualization -->
    <section class="settings-section">
      <h2>{{ t('neo_ui.settings.visualization.title') }}</h2>
      <div class="field-grid">
        <label class="field">
          <span class="field-label">{{ t('neo_ui.settings.visualization.interpolation') }}</span>
          <input type="number" v-model.number="s.visualization.interpolation_factor" step="10" min="10" max="200" />
        </label>
        <label class="field field--toggle">
          <input type="checkbox" v-model="s.visualization.show_minutes" />
          <span class="field-label">{{ t('neo_ui.settings.visualization.show_minutes') }}</span>
        </label>
        <label class="field field--toggle">
          <input type="checkbox" v-model="s.visualization.show_degrees" />
          <span class="field-label">{{ t('neo_ui.settings.visualization.show_degrees') }}</span>
        </label>
      </div>
    </section>

    <div class="actions-bar">
      <button class="btn btn--danger" @click="resetAll">{{ t('neo_ui.settings.reset') }}</button>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  max-width: 600px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

h2 {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 10px;
}

.settings-section {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  margin-bottom: 8px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field-label {
  font-size: 11px;
  color: var(--text-muted);
}

.field input[type="number"],
.field select {
  padding: 5px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-mono);
  outline: none;
  transition: border-color var(--transition-fast);
}

.field input:focus,
.field select:focus {
  border-color: var(--accent-primary);
}

.field--toggle {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.field--toggle input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-primary);
}

.preset-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-btn {
  padding: 6px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.preset-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.preset-btn--active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.preset-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
  font-style: italic;
}

.actions-bar {
  margin-top: 16px;
}

.btn--danger {
  background: transparent;
  border-color: var(--accent-error);
  color: var(--accent-error);
  font-size: 12px;
}

.btn--danger:hover {
  background: var(--accent-error);
  color: #fff;
}
</style>
