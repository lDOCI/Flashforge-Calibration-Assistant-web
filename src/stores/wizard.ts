import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { StageKey } from '@/lib/calibration/types'

type StepKey = Exclude<StageKey, 'initial'>

/** What the wizard predicted for a step the user said they did. */
export interface StepCheck {
  fromId: string
  stageKey: StepKey
  predicted: number[][]
  predictedRange: number
}

/**
 * Wizard-only state: skipped steps per measurement, and the prediction to
 * check against the next measurement the user loads.
 */
export const useWizardStore = defineStore('wizard', () => {
  const skipped = ref<Record<string, StepKey[]>>({})
  const pending = ref<StepCheck | null>(null)
  /** Keyed by the id of the measurement taken after the step. */
  const checks = ref<Record<string, StepCheck>>({})

  function skip(wsId: string, key: StepKey) {
    skipped.value[wsId] = [...(skipped.value[wsId] ?? []), key]
  }

  function unskip(wsId: string, key: StepKey) {
    skipped.value[wsId] = (skipped.value[wsId] ?? []).filter(k => k !== key)
  }

  /** The next loaded measurement gets compared with this prediction. */
  function expect(check: StepCheck) {
    pending.value = check
  }

  function attachTo(wsId: string) {
    if (!pending.value || pending.value.fromId === wsId) return
    checks.value[wsId] = pending.value
    pending.value = null
  }

  return { skipped, pending, checks, skip, unskip, expect, attachTo }
})
