import { describe, expect, it } from 'vitest'
import { calcSpectrogram } from './shaperCalibrate'

function rawSignal(seconds: number, fs: number, f: (t: number) => number): Float64Array[] {
  return Array.from({ length: Math.round(seconds * fs) }, (_, i) => {
    const t = i / fs
    return new Float64Array([t, f(t), 0, 0])
  })
}

describe('spectrogram', () => {
  it('shows a steady 55 Hz resonance as the strongest column', () => {
    const sp = calcSpectrogram(rawSignal(10, 3200, t => Math.sin(2 * Math.PI * 55 * t)))!
    expect(sp.power.length).toBeGreaterThan(10)
    const totals = sp.freqs.map((_, k) => sp.power.reduce((s, row) => s + row[k], 0))
    const peak = sp.freqs[totals.indexOf(Math.max(...totals))]
    expect(Math.abs(peak - 55)).toBeLessThan(3)
    expect(sp.freqs[sp.freqs.length - 1]).toBeLessThanOrEqual(200)
  })

  it('follows a rising sweep over time', () => {
    // 10 → 110 Hz over 10 s: phase = 2π(10t + 5t²)
    const sp = calcSpectrogram(rawSignal(10, 3200, t => Math.sin(2 * Math.PI * (10 * t + 5 * t * t))))!
    const peakAt = (row: number[]) => sp.freqs[row.indexOf(Math.max(...row))]
    expect(peakAt(sp.power[0])).toBeLessThan(peakAt(sp.power[sp.power.length - 1]))
  })
})
