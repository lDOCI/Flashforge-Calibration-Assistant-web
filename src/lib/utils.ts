/** Create an evenly spaced array from start to stop (inclusive). */
export function linspace(start: number, stop: number, n: number): number[] {
  if (n <= 1) return [start]
  const step = (stop - start) / (n - 1)
  return Array.from({ length: n }, (_, i) => start + i * step)
}

/** Mean of a flat array. */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** Mean of a 2D matrix. */
export function mean2D(m: number[][]): number {
  let sum = 0
  let count = 0
  for (const row of m) {
    for (const v of row) {
      sum += v
      count++
    }
  }
  return count === 0 ? 0 : sum / count
}

/** Max of a 2D matrix. */
export function max2D(m: number[][]): number {
  let result = -Infinity
  for (const row of m) {
    for (const v of row) {
      if (v > result) result = v
    }
  }
  return result
}

/** Min of a 2D matrix. */
export function min2D(m: number[][]): number {
  let result = Infinity
  for (const row of m) {
    for (const v of row) {
      if (v < result) result = v
    }
  }
  return result
}

/** Deep copy a 2D number array. */
export function copyMatrix(m: number[][]): number[][] {
  return m.map(row => [...row])
}

/** Create a 2D matrix filled with a value. */
export function fullMatrix(rows: number, cols: number, value: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(value))
}

/** Create a 2D matrix of zeros. */
export function zerosMatrix(rows: number, cols: number): number[][] {
  return fullMatrix(rows, cols, 0)
}

/** Flatten a 2D matrix to 1D. */
export function flatten(m: number[][]): number[] {
  const result: number[] = []
  for (const row of m) {
    for (const v of row) {
      result.push(v)
    }
  }
  return result
}

/** Clamp a value between min and max. */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value))
}

/** Generate a unique ID. */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
