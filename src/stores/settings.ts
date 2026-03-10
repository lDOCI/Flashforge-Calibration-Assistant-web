import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import type { CalibrationSettings } from '@/lib/calibration/types'

const STORAGE_KEY = 'flashforge_settings'

function defaultSettings(): CalibrationSettings {
  return {
    hardware: {
      screw_pitch: 0.7,
      min_adjustment: 0.02,
      max_adjustment: 4.0,
      tape_thickness: 0.06,
      belt_tooth_mm: 0.4,
      corner_averaging: 0,
      screw_mode: 'hold_nut',
    },
    thresholds: {
      belt_threshold: 0.4,
      screw_threshold: 0.19,
      tape_threshold: 0.01,
    },
    visualization: {
      interpolation_factor: 100,
      show_minutes: true,
      show_degrees: true,
    },
    environment: {
      measurement_temp: 25.0,
      target_temp: 25.0,
      thermal_expansion_coeff: 0.0,
    },
    workflow: {
      enable_belt: true,
      enable_screws: true,
      enable_tape: true,
    },
  }
}

function loadFromStorage(): CalibrationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Merge with defaults to handle new fields
      const defaults = defaultSettings()
      return {
        hardware: { ...defaults.hardware, ...parsed.hardware },
        thresholds: { ...defaults.thresholds, ...parsed.thresholds },
        visualization: { ...defaults.visualization, ...parsed.visualization },
        environment: { ...defaults.environment, ...parsed.environment },
        workflow: { ...defaults.workflow, ...parsed.workflow },
        thermal_model: parsed.thermal_model,
      }
    }
  } catch {
    // ignore
  }
  return defaultSettings()
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive<CalibrationSettings>(loadFromStorage())

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }

  function reset() {
    Object.assign(settings, defaultSettings())
    save()
  }

  // Auto-save on changes
  watch(() => settings, () => save(), { deep: true })

  return { settings, save, reset }
})
