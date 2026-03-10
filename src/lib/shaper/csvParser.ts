import type { CalibrationData } from './types'
import { createCalibrationData, normalizeToFrequencies } from './shaperCalibrate'

/**
 * Parse accelerometer CSV.
 * Supports two formats:
 * 1. Raw accelerometer: time, accel_x, accel_y, accel_z
 * 2. Pre-processed PSD: freq, psd_x, psd_y, psd_z, psd_xyz [, shaper_vals...]
 */
export function parseShaperCsv(
  content: string,
): { type: 'raw'; data: Float64Array[] } | { type: 'psd'; data: CalibrationData } | null {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return null

  // Check header for format detection
  let headerLine = ''
  let dataStartIdx = 0
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#')) {
      headerLine = lines[i]
      dataStartIdx = i + 1
      break
    }
  }

  const isPsd = headerLine.startsWith('freq,psd_x,psd_y,psd_z,psd_xyz')

  if (isPsd) {
    // Pre-processed PSD data
    const rows: number[][] = []
    for (let i = dataStartIdx; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith('#')) continue
      const values = line.split(',').map(v => parseFloat(v.trim()))
      if (values.some(v => isNaN(v))) continue
      rows.push(values)
    }

    if (rows.length === 0) return null

    const n = rows.length
    const freqBins = new Float64Array(n)
    const psdX = new Float64Array(n)
    const psdY = new Float64Array(n)
    const psdZ = new Float64Array(n)
    const psdXyz = new Float64Array(n)

    for (let i = 0; i < n; i++) {
      freqBins[i] = rows[i][0]
      psdX[i] = rows[i][1]
      psdY[i] = rows[i][2]
      psdZ[i] = rows[i][3]
      psdXyz[i] = rows[i][4]
    }

    const calibData = createCalibrationData(freqBins, psdXyz, psdX, psdY, psdZ)

    // If no shaper columns in header, normalize to frequencies
    if (!headerLine.includes('mzv')) {
      normalizeToFrequencies(calibData)
    }

    return { type: 'psd', data: calibData }
  } else {
    // Raw accelerometer data: skip comment lines, parse 4-column CSV
    const rows: Float64Array[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith('#')) continue
      const values = line.split(',').map(v => parseFloat(v.trim()))
      if (values.length < 4 || values.some(v => isNaN(v))) continue
      rows.push(new Float64Array(values.slice(0, 4)))
    }

    if (rows.length === 0) return null
    return { type: 'raw', data: rows }
  }
}
