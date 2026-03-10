import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CalibrationData, CalibrationResult } from '@/lib/shaper/types'
import { parseShaperCsv } from '@/lib/shaper/csvParser'
import {
  calcFreqResponse,
  normalizeToFrequencies,
  findBestShaper,
} from '@/lib/shaper/shaperCalibrate'

export const useShaperStore = defineStore('shaper', () => {
  const calibrationDataX = ref<CalibrationData | null>(null)
  const calibrationDataY = ref<CalibrationData | null>(null)

  const resultX = ref<CalibrationResult | null>(null)
  const resultY = ref<CalibrationResult | null>(null)

  const allShapersX = ref<CalibrationResult[]>([])
  const allShapersY = ref<CalibrationResult[]>([])

  const selectedShaperX = ref<string>('')
  const selectedShaperY = ref<string>('')

  function loadCsv(axis: 'x' | 'y', content: string) {
    const parsed = parseShaperCsv(content)
    if (!parsed) throw new Error('Failed to parse shaper CSV')

    let calibData: CalibrationData

    if (parsed.type === 'psd') {
      calibData = parsed.data
    } else {
      // Raw accelerometer data — compute frequency response
      const result = calcFreqResponse(parsed.data)
      if (!result) throw new Error('Failed to compute frequency response')
      normalizeToFrequencies(result)
      calibData = result
    }

    if (axis === 'x') {
      calibrationDataX.value = calibData
    } else {
      calibrationDataY.value = calibData
    }

    // Auto-analyze
    analyze(axis)
  }

  function analyze(axis: 'x' | 'y') {
    const data = axis === 'x' ? calibrationDataX.value : calibrationDataY.value
    if (!data) return

    const [bestShaper, allResults] = findBestShaper(data)

    if (axis === 'x') {
      resultX.value = bestShaper
      allShapersX.value = allResults
      selectedShaperX.value = bestShaper.name
    } else {
      resultY.value = bestShaper
      allShapersY.value = allResults
      selectedShaperY.value = bestShaper.name
    }
  }

  function selectShaper(axis: 'x' | 'y', name: string) {
    const shapers = axis === 'x' ? allShapersX.value : allShapersY.value
    const found = shapers.find(s => s.name === name)
    if (!found) return

    if (axis === 'x') {
      selectedShaperX.value = name
      resultX.value = found
    } else {
      selectedShaperY.value = name
      resultY.value = found
    }
  }

  function getKlipperConfig(): string {
    const lines: string[] = ['[input_shaper]']
    if (resultX.value) {
      lines.push(`shaper_type_x = ${resultX.value.name}`)
      lines.push(`shaper_freq_x = ${resultX.value.freq.toFixed(1)}`)
    }
    if (resultY.value) {
      lines.push(`shaper_type_y = ${resultY.value.name}`)
      lines.push(`shaper_freq_y = ${resultY.value.freq.toFixed(1)}`)
    }
    return lines.join('\n')
  }

  return {
    calibrationDataX,
    calibrationDataY,
    resultX,
    resultY,
    allShapersX,
    allShapersY,
    selectedShaperX,
    selectedShaperY,
    loadCsv,
    analyze,
    selectShaper,
    getKlipperConfig,
  }
})
