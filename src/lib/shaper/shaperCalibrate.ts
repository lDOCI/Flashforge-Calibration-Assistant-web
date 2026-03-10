/**
 * Input shaper calibration — PSD via Welch's method + shaper fitting.
 * Ported from Klipper's shaper_calibrate.py
 *
 * Copyright (C) 2020  Dmitry Butyugin <dmbutyugin@google.com>
 * This file may be distributed under the terms of the GNU GPLv3 license.
 */
import type {
  CalibrationData,
  CalibrationResult,
  ShaperParams,
  InputShaperCfg,
} from './types'
import {
  SHAPER_VIBRATION_REDUCTION,
  DEFAULT_DAMPING_RATIO,
  INPUT_SHAPERS,
  AUTOTUNE_SHAPERS,
} from './shaperDefs'

const MIN_FREQ = 5
const MAX_FREQ = 200
const WINDOW_T_SEC = 0.5
const MAX_SHAPER_FREQ = 150
const TEST_DAMPING_RATIOS = [0.075, 0.1, 0.15]
const TARGET_SMOOTHING = 0.12

// ---------- math helpers ----------

/** Bessel function I0 — polynomial approximation. */
function besselI0(x: number): number {
  const ax = Math.abs(x)
  if (ax < 3.75) {
    const t = (x / 3.75) ** 2
    return (
      1 +
      t *
        (3.5156229 +
          t *
            (3.0899424 +
              t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813)))))
    )
  }
  const t = 3.75 / ax
  return (
    (Math.exp(ax) / Math.sqrt(ax)) *
    (0.39894228 +
      t *
        (0.01328592 +
          t *
            (0.00225319 +
              t *
                (-0.00157565 +
                  t *
                    (0.00916281 +
                      t *
                        (-0.02057706 +
                          t * (0.02635537 + t * (-0.01647633 + t * 0.00392377))))))))
  )
}

/** Kaiser window. */
function kaiserWindow(n: number, beta: number): Float64Array {
  const w = new Float64Array(n)
  const denom = besselI0(beta)
  for (let i = 0; i < n; i++) {
    const ratio = (2 * i) / (n - 1) - 1
    w[i] = besselI0(beta * Math.sqrt(1 - ratio * ratio)) / denom
  }
  return w
}

/** Frequency bins for one-sided FFT. */
function rfftfreq(n: number, d: number): Float64Array {
  const bins = Math.floor(n / 2) + 1
  const result = new Float64Array(bins)
  for (let i = 0; i < bins; i++) result[i] = i / (n * d)
  return result
}

/**
 * Simple radix-2 Cooley-Tukey FFT (in-place, complex).
 * Expects interleaved [re0, im0, re1, im1, ...] of length 2*n.
 */
function fftComplex(data: Float64Array, n: number): void {
  // Bit-reversal permutation
  let j = 0
  for (let i = 0; i < n; i++) {
    if (i < j) {
      let tmp = data[2 * i]
      data[2 * i] = data[2 * j]
      data[2 * j] = tmp
      tmp = data[2 * i + 1]
      data[2 * i + 1] = data[2 * j + 1]
      data[2 * j + 1] = tmp
    }
    let m = n >> 1
    while (m >= 1 && j >= m) {
      j -= m
      m >>= 1
    }
    j += m
  }

  // Butterfly
  for (let step = 1; step < n; step <<= 1) {
    const halfStep = step
    const tableStep = Math.PI / halfStep
    for (let group = 0; group < n; group += step << 1) {
      for (let pair = 0; pair < halfStep; pair++) {
        const angle = -pair * tableStep
        const wr = Math.cos(angle)
        const wi = Math.sin(angle)
        const i1 = group + pair
        const i2 = i1 + halfStep
        const tr = wr * data[2 * i2] - wi * data[2 * i2 + 1]
        const ti = wr * data[2 * i2 + 1] + wi * data[2 * i2]
        data[2 * i2] = data[2 * i1] - tr
        data[2 * i2 + 1] = data[2 * i1 + 1] - ti
        data[2 * i1] += tr
        data[2 * i1 + 1] += ti
      }
    }
  }
}

/** Real FFT returning one-sided complex spectrum (interleaved). */
function rfft(input: Float64Array, n: number): Float64Array {
  const complex = new Float64Array(2 * n)
  for (let i = 0; i < n; i++) {
    complex[2 * i] = input[i]
    complex[2 * i + 1] = 0
  }
  fftComplex(complex, n)
  const bins = Math.floor(n / 2) + 1
  return complex.subarray(0, 2 * bins)
}

// ---------- PSD via Welch's method ----------

function computePSD(
  x: Float64Array,
  fs: number,
  nfft: number,
): [Float64Array, Float64Array] {
  const window = kaiserWindow(nfft, 6.0)
  let windowSqSum = 0
  for (let i = 0; i < nfft; i++) windowSqSum += window[i] * window[i]
  const scale = 1.0 / windowSqSum

  const overlap = Math.floor(nfft / 2)
  const step = nfft - overlap
  const nWindows = Math.floor((x.length - overlap) / step)
  if (nWindows <= 0) {
    return [new Float64Array(0), new Float64Array(0)]
  }

  const nBins = Math.floor(nfft / 2) + 1
  const psdAccum = new Float64Array(nBins)

  for (let w = 0; w < nWindows; w++) {
    const offset = w * step

    // Compute mean for detrending
    let winMean = 0
    for (let i = 0; i < nfft; i++) winMean += x[offset + i]
    winMean /= nfft

    // Detrend + window
    const windowed = new Float64Array(nfft)
    for (let i = 0; i < nfft; i++) {
      windowed[i] = window[i] * (x[offset + i] - winMean)
    }

    // FFT
    const spectrum = rfft(windowed, nfft)

    // Power
    for (let i = 0; i < nBins; i++) {
      const re = spectrum[2 * i]
      const im = spectrum[2 * i + 1]
      let power = (re * re + im * im) * scale / fs
      if (i > 0 && i < nBins - 1) power *= 2
      psdAccum[i] += power
    }
  }

  // Average
  for (let i = 0; i < nBins; i++) psdAccum[i] /= nWindows

  const freqs = rfftfreq(nfft, 1 / fs)
  return [freqs, psdAccum]
}

// ---------- ShaperCalibrate ----------

export function createCalibrationData(
  freqBins: Float64Array,
  psdSum: Float64Array,
  psdX: Float64Array,
  psdY: Float64Array,
  psdZ: Float64Array,
): CalibrationData {
  return { freqBins, psdSum, psdX, psdY, psdZ, dataSets: 1 }
}

export function normalizeToFrequencies(data: CalibrationData): void {
  const psds = [data.psdSum, data.psdX, data.psdY, data.psdZ]
  for (const psd of psds) {
    for (let i = 0; i < psd.length; i++) {
      psd[i] /= data.freqBins[i] + 0.1
      if (data.freqBins[i] < MIN_FREQ) psd[i] = 0
    }
  }
}

export function calcFreqResponse(rawData: Float64Array[]): CalibrationData | null {
  // rawData: 2D array [N x 4] columns: time, accel_x, accel_y, accel_z
  const N = rawData.length
  if (N === 0) return null
  const T = rawData[N - 1][0] - rawData[0][0]
  if (T <= 0) return null
  const samplingFreq = N / T

  // Round up to nearest power of 2
  const windowSamples = samplingFreq * WINDOW_T_SEC
  let M = 1
  while (M < windowSamples) M <<= 1
  if (N <= M) return null

  // Extract axis data
  const xData = new Float64Array(N)
  const yData = new Float64Array(N)
  const zData = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    xData[i] = rawData[i][1]
    yData[i] = rawData[i][2]
    zData[i] = rawData[i][3]
  }

  const [fx, px] = computePSD(xData, samplingFreq, M)
  const [, py] = computePSD(yData, samplingFreq, M)
  const [, pz] = computePSD(zData, samplingFreq, M)

  const psdSum = new Float64Array(px.length)
  for (let i = 0; i < px.length; i++) {
    psdSum[i] = px[i] + py[i] + pz[i]
  }

  return createCalibrationData(fx, psdSum, px, py, pz)
}

// ---------- shaper estimation ----------

function estimateShaper(
  shaper: ShaperParams,
  testDr: number,
  testFreqs: Float64Array,
): Float64Array {
  const { A, T } = shaper
  const n = A.length
  let invD = 0
  for (let i = 0; i < n; i++) invD += A[i]
  invD = 1.0 / invD
  const tLast = T[n - 1]

  const result = new Float64Array(testFreqs.length)
  for (let fi = 0; fi < testFreqs.length; fi++) {
    const omega = 2 * Math.PI * testFreqs[fi]
    const damping = testDr * omega
    const omegaD = omega * Math.sqrt(1 - testDr * testDr)

    let sumS = 0
    let sumC = 0
    for (let i = 0; i < n; i++) {
      const w = A[i] * Math.exp(-damping * (tLast - T[i]))
      sumS += w * Math.sin(omegaD * T[i])
      sumC += w * Math.cos(omegaD * T[i])
    }
    result[fi] = Math.sqrt(sumS * sumS + sumC * sumC) * invD
  }
  return result
}

function estimateRemainingVibrations(
  shaper: ShaperParams,
  testDr: number,
  freqBins: Float64Array,
  psd: Float64Array,
): [number, Float64Array] {
  const vals = estimateShaper(shaper, testDr, freqBins)
  let psdMax = 0
  for (let i = 0; i < psd.length; i++) {
    if (psd[i] > psdMax) psdMax = psd[i]
  }
  const vibrThreshold = psdMax / SHAPER_VIBRATION_REDUCTION

  let remaining = 0
  let all = 0
  for (let i = 0; i < psd.length; i++) {
    remaining += Math.max(vals[i] * psd[i] - vibrThreshold, 0)
    all += Math.max(psd[i] - vibrThreshold, 0)
  }
  return [all > 0 ? remaining / all : 0, vals]
}

function getShaperSmoothing(
  shaper: ShaperParams,
  accel: number = 5000,
  scv: number = 5,
): number {
  const halfAccel = accel * 0.5
  const { A, T } = shaper
  const n = A.length
  let invD = 0
  for (let i = 0; i < n; i++) invD += A[i]
  invD = 1.0 / invD

  let ts = 0
  for (let i = 0; i < n; i++) ts += A[i] * T[i]
  ts *= invD

  let offset90 = 0
  let offset180 = 0
  for (let i = 0; i < n; i++) {
    if (T[i] >= ts) {
      offset90 += A[i] * (scv + halfAccel * (T[i] - ts)) * (T[i] - ts)
    }
    offset180 += A[i] * halfAccel * (T[i] - ts) ** 2
  }
  offset90 *= invD * Math.sqrt(2)
  offset180 *= invD
  return Math.max(offset90, offset180)
}

function bisect(func: (x: number) => boolean): number {
  let left = 1.0
  let right = 1.0

  while (!func(left)) {
    right = left
    left *= 0.5
  }
  if (right === left) {
    while (func(right)) right *= 2.0
  }
  while (right - left > 1e-8) {
    const middle = (left + right) * 0.5
    if (func(middle)) left = middle
    else right = middle
  }
  return left
}

function findShaperMaxAccel(shaper: ShaperParams): number {
  return bisect(
    (testAccel: number) => getShaperSmoothing(shaper, testAccel) <= TARGET_SMOOTHING,
  )
}

// ---------- public API ----------

export function fitShaper(
  shaperCfg: InputShaperCfg,
  calibrationData: CalibrationData,
  maxSmoothing: number | null,
): CalibrationResult {
  // Build test frequencies
  const testFreqCount = Math.ceil((MAX_SHAPER_FREQ - shaperCfg.minFreq) / 0.2)
  const testFreqs = new Float64Array(testFreqCount)
  for (let i = 0; i < testFreqCount; i++) {
    testFreqs[i] = shaperCfg.minFreq + i * 0.2
  }

  // Filter PSD to MAX_FREQ
  let psdLen = 0
  for (let i = 0; i < calibrationData.freqBins.length; i++) {
    if (calibrationData.freqBins[i] <= MAX_FREQ) psdLen = i + 1
  }
  const freqBins = calibrationData.freqBins.subarray(0, psdLen)
  const psd = calibrationData.psdSum.subarray(0, psdLen)

  let bestRes: CalibrationResult | null = null
  const results: CalibrationResult[] = []

  // Sweep from high to low frequency
  for (let ti = testFreqCount - 1; ti >= 0; ti--) {
    const testFreq = testFreqs[ti]
    const shaper = shaperCfg.initFunc(testFreq, DEFAULT_DAMPING_RATIO)
    const shaperSmoothing = getShaperSmoothing(shaper)

    if (maxSmoothing !== null && shaperSmoothing > maxSmoothing && bestRes) {
      return bestRes
    }

    let shaperVibrations = 0
    let shaperVals = new Float64Array(freqBins.length)

    for (const dr of TEST_DAMPING_RATIOS) {
      const [vibrations, vals] = estimateRemainingVibrations(shaper, dr, freqBins, psd)
      for (let i = 0; i < shaperVals.length; i++) {
        shaperVals[i] = Math.max(shaperVals[i], vals[i])
      }
      if (vibrations > shaperVibrations) shaperVibrations = vibrations
    }

    const maxAccel = findShaperMaxAccel(shaper)
    const shaperScore =
      shaperSmoothing * (shaperVibrations ** 1.5 + shaperVibrations * 0.2 + 0.01)

    const result: CalibrationResult = {
      name: shaperCfg.name,
      freq: testFreq,
      vals: shaperVals,
      vibrs: shaperVibrations,
      smoothing: shaperSmoothing,
      score: shaperScore,
      maxAccel,
    }
    results.push(result)

    if (bestRes === null || bestRes.vibrs > result.vibrs) {
      bestRes = result
    }
  }

  // Find optimal: not much worse vibration but much less smoothing
  let selected = bestRes!
  for (let i = results.length - 1; i >= 0; i--) {
    const res = results[i]
    if (res.vibrs < bestRes!.vibrs * 1.1 && res.score < selected.score) {
      selected = res
    }
  }

  return selected
}

export function findBestShaper(
  calibrationData: CalibrationData,
  maxSmoothing: number | null = null,
): [CalibrationResult, CalibrationResult[]] {
  let bestShaper: CalibrationResult | null = null
  const allShapers: CalibrationResult[] = []

  for (const shaperCfg of INPUT_SHAPERS) {
    if (!AUTOTUNE_SHAPERS.includes(shaperCfg.name)) continue
    const shaper = fitShaper(shaperCfg, calibrationData, maxSmoothing)
    allShapers.push(shaper)

    if (
      bestShaper === null ||
      shaper.score * 1.2 < bestShaper.score ||
      (shaper.score * 1.05 < bestShaper.score &&
        shaper.smoothing * 1.1 < bestShaper.smoothing)
    ) {
      bestShaper = shaper
    }
  }

  return [bestShaper!, allShapers]
}
