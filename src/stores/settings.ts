import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import type { CalibrationSettings } from '@/lib/calibration/types'

const STORAGE_KEY = 'flashforge_settings_v2'
const LEGACY_KEY = 'flashforge_settings'

export function defaultSettings(): CalibrationSettings {
  return {
    hardware: {
      screw_pitch: 0.7,
      min_adjustment: 0.02,
      max_adjustment: 2.0,
      tape_thickness: 0.06,
      max_tape_layers: 4,
      belt_tooth_mm: 0.4,
      screw_mode: 'hold_nut',
    },
    geometry: {
      bed_size_x: 220,
      bed_size_y: 220,
      shaft_front_left: [-110, -110],
      shaft_front_right: [110, -110],
      shaft_back: [0, 110],
      screw_offset_x: 105,
      screw_offset_y: 105,
    },
    thresholds: {
      belt_threshold: 0.15,
      screw_threshold: 0.03,
      tape_threshold: 0.03,
    },
    visualization: {
      interpolation_factor: 100,
      show_minutes: true,
      show_degrees: true,
    },
    workflow: {
      enable_belt: true,
      enable_screws: true,
      enable_tape: true,
    },
  }
}

function readJson(key: string): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function withoutKeys(obj: Record<string, unknown> | undefined, keys: string[]) {
  return Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !keys.includes(k)))
}

function loadFromStorage(): CalibrationSettings {
  const d = defaultSettings()
  const saved = readJson(STORAGE_KEY)
  if (saved) {
    return {
      // Dropped in 2.1: bed_flex (screws only tilt), tape_patch_mm (fixed stencil cells).
      hardware: { ...d.hardware, ...withoutKeys(saved.hardware, ['bed_flex', 'tape_patch_mm']) },
      geometry: { ...d.geometry, ...saved.geometry },
      thresholds: { ...d.thresholds, ...saved.thresholds },
      visualization: { ...d.visualization, ...saved.visualization },
      workflow: { ...d.workflow, ...saved.workflow },
    }
  }
  // v1 thresholds meant something else; carry over only the hardware the user set.
  const legacy = readJson(LEGACY_KEY)
  if (legacy?.hardware) {
    for (const key of ['screw_pitch', 'tape_thickness', 'belt_tooth_mm', 'screw_mode'] as const) {
      if (legacy.hardware[key] !== undefined) (d.hardware as Record<string, unknown>)[key] = legacy.hardware[key]
    }
  }
  if (legacy?.workflow) Object.assign(d.workflow, legacy.workflow)
  return d
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive<CalibrationSettings>(loadFromStorage())

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // storage unavailable (private mode); settings stay in memory
    }
  }

  function reset() {
    Object.assign(settings, defaultSettings())
    save()
  }

  watch(() => settings, save, { deep: true })

  return { settings, save, reset }
})
