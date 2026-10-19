import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import type { StageAction } from '@/lib/calibration/types'

/** One-line, user-facing text for a stage action. */
export function useActionFormat() {
  const { t } = useI18n()
  const settingsStore = useSettingsStore()

  function formatAction(action: StageAction): string {
    const where = t(action.label)
    const mm = `${(action.magnitudeMm ?? 0).toFixed(2)} ${t('neo_ui.units.mm')}`

    if (action.kind === 'belt') {
      const dir = action.direction === 'up' ? t('neo_ui.visual.belt.up') : t('neo_ui.visual.belt.down')
      return `${where}: ${dir} — ${t('neo_ui.visual.belt.teeth_with_mm', { count: action.teeth, mm: (action.magnitudeMm ?? 0).toFixed(1) })}`
    }
    if (action.kind === 'screw') {
      let clockwise = action.direction === 'clockwise'
      if (settingsStore.settings.hardware.screw_mode === 'hold_screw') clockwise = !clockwise
      const dir = clockwise ? t('neo_ui.visual.screw.clockwise') : t('neo_ui.visual.screw.counterclockwise')
      return `${where}: ${dir} ${Math.round(action.minutes ?? 0)}′ (${Math.round(action.degrees ?? 0)}°) — ${mm}`
    }
    const layers = (action.metadata.layers as number) ?? 1
    return `${where}: ${t('neo_ui.visual.tape.layers_short', { value: layers })}`
  }

  return { formatAction }
}
