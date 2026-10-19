/** Create an evenly spaced array from start to stop (inclusive). */
export function linspace(start: number, stop: number, n: number): number[] {
  if (n <= 1) return [start]
  const step = (stop - start) / (n - 1)
  return Array.from({ length: n }, (_, i) => start + i * step)
}

/** Generate a unique ID. */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
