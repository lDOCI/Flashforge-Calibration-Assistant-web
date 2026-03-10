/**
 * Input shaper definitions.
 * Ported from Klipper's shaper_defs.py
 *
 * Copyright (C) 2020-2021  Dmitry Butyugin <dmbutyugin@google.com>
 * This file may be distributed under the terms of the GNU GPLv3 license.
 */
import type { ShaperParams, InputShaperCfg } from './types'

export const SHAPER_VIBRATION_REDUCTION = 20.0
export const DEFAULT_DAMPING_RATIO = 0.1

export function getZvShaper(freq: number, dr: number): ShaperParams {
  const df = Math.sqrt(1 - dr * dr)
  const K = Math.exp((-dr * Math.PI) / df)
  const td = 1 / (freq * df)
  return { A: [1, K], T: [0, 0.5 * td] }
}

export function getZvdShaper(freq: number, dr: number): ShaperParams {
  const df = Math.sqrt(1 - dr * dr)
  const K = Math.exp((-dr * Math.PI) / df)
  const td = 1 / (freq * df)
  return { A: [1, 2 * K, K * K], T: [0, 0.5 * td, td] }
}

export function getMzvShaper(freq: number, dr: number): ShaperParams {
  const df = Math.sqrt(1 - dr * dr)
  const K = Math.exp((-0.75 * dr * Math.PI) / df)
  const td = 1 / (freq * df)

  const a1 = 1 - 1 / Math.sqrt(2)
  const a2 = (Math.sqrt(2) - 1) * K
  const a3 = a1 * K * K

  return { A: [a1, a2, a3], T: [0, 0.375 * td, 0.75 * td] }
}

export function getEiShaper(freq: number, dr: number): ShaperParams {
  const vTol = 1 / SHAPER_VIBRATION_REDUCTION
  const df = Math.sqrt(1 - dr * dr)
  const K = Math.exp((-dr * Math.PI) / df)
  const td = 1 / (freq * df)

  const a1 = 0.25 * (1 + vTol)
  const a2 = 0.5 * (1 - vTol) * K
  const a3 = a1 * K * K

  return { A: [a1, a2, a3], T: [0, 0.5 * td, td] }
}

export function get2HumpEiShaper(freq: number, dr: number): ShaperParams {
  const vTol = 1 / SHAPER_VIBRATION_REDUCTION
  const df = Math.sqrt(1 - dr * dr)
  const K = Math.exp((-dr * Math.PI) / df)
  const td = 1 / (freq * df)

  const V2 = vTol * vTol
  const X = Math.pow(V2 * (Math.sqrt(1 - V2) + 1), 1 / 3)
  const a1 = (3 * X * X + 2 * X + 3 * V2) / (16 * X)
  const a2 = (0.5 - a1) * K
  const a3 = a2 * K
  const a4 = a1 * K * K * K

  return { A: [a1, a2, a3, a4], T: [0, 0.5 * td, td, 1.5 * td] }
}

export function get3HumpEiShaper(freq: number, dr: number): ShaperParams {
  const vTol = 1 / SHAPER_VIBRATION_REDUCTION
  const df = Math.sqrt(1 - dr * dr)
  const K = Math.exp((-dr * Math.PI) / df)
  const td = 1 / (freq * df)

  const K2 = K * K
  const a1 = 0.0625 * (1 + 3 * vTol + 2 * Math.sqrt(2 * (vTol + 1) * vTol))
  const a2 = 0.25 * (1 - vTol) * K
  const a3 = (0.5 * (1 + vTol) - 2 * a1) * K2
  const a4 = a2 * K2
  const a5 = a1 * K2 * K2

  return { A: [a1, a2, a3, a4, a5], T: [0, 0.5 * td, td, 1.5 * td, 2 * td] }
}

export const INPUT_SHAPERS: InputShaperCfg[] = [
  { name: 'zv', initFunc: getZvShaper, minFreq: 21 },
  { name: 'mzv', initFunc: getMzvShaper, minFreq: 23 },
  { name: 'zvd', initFunc: getZvdShaper, minFreq: 29 },
  { name: 'ei', initFunc: getEiShaper, minFreq: 29 },
  { name: '2hump_ei', initFunc: get2HumpEiShaper, minFreq: 39 },
  { name: '3hump_ei', initFunc: get3HumpEiShaper, minFreq: 48 },
]

export const AUTOTUNE_SHAPERS = ['zv', 'mzv', 'ei', '2hump_ei', '3hump_ei']
