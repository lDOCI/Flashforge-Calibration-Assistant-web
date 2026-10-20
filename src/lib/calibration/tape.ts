/**
 * Shim low spots with aluminium tape under the build sheet.
 *
 * Tape can only raise the surface, so the question is which level to build
 * up to. Every node height is tried as that target level: nodes below it get
 * `round(depth / thickness)` layers (capped). Each layer on each patch is
 * real work, so it has to pay for itself: the score is the resulting range
 * plus `LAYER_COST` per layer, and the lowest score wins. Without that cost
 * the search happily tapes most of the bed to shave off hundredths of a mm.
 *
 * `planTape` works on whatever grid it is given; the workflow hands it patch
 * heights (see `patchGrid`), not raw dense meshes. A spring-steel sheet bridges
 * small gaps, which smooths the real result slightly.
 */
import { type Grid, rangeOf } from './grid'

/** Range reduction (mm) one layer on one patch must buy to be worth sticking. */
export const LAYER_COST = 0.005

export interface TapeSpot {
  row: number
  col: number
  layers: number
  /** Depth below the target level before taping, mm. */
  depth: number
}

export interface TapeOptions {
  thickness: number
  maxLayers: number
  /** Ignore spots shallower than this, mm. */
  minDepth: number
}

export interface TapePlan {
  spots: TapeSpot[]
  meshAfter: number[][]
  rangeBefore: number
  rangeAfter: number
}

function layersFor(mesh: number[][], level: number, opts: TapeOptions): number[][] {
  return mesh.map(row =>
    row.map(v => {
      const depth = level - v
      if (depth < opts.minDepth) return 0
      return Math.min(opts.maxLayers, Math.max(0, Math.round(depth / opts.thickness)))
    }),
  )
}

export function planTape(mesh: number[][], opts: TapeOptions): TapePlan {
  const rangeBefore = rangeOf(mesh)
  const levels = [...new Set(mesh.flat())].sort((a, b) => a - b)

  let best = { layers: mesh.map(r => r.map(() => 0)), range: rangeBefore, score: rangeBefore, level: 0 }
  for (const level of levels) {
    const layers = layersFor(mesh, level, opts)
    const after = mesh.map((row, i) => row.map((v, j) => v + layers[i][j] * opts.thickness))
    const range = rangeOf(after)
    const total = layers.flat().reduce((s, n) => s + n, 0)
    const score = range + LAYER_COST * total
    if (score < best.score - 1e-9) best = { layers, range, score, level }
  }

  const spots: TapeSpot[] = []
  best.layers.forEach((row, i) =>
    row.forEach((n, j) => {
      if (n > 0) spots.push({ row: i, col: j, layers: n, depth: best.level - mesh[i][j] })
    }),
  )
  spots.sort((a, b) => b.depth - a.depth)

  return {
    spots,
    meshAfter: mesh.map((row, i) => row.map((v, j) => v + best.layers[i][j] * opts.thickness)),
    rangeBefore,
    rangeAfter: best.range,
  }
}

/**
 * Tape comes in pieces a few centimetres wide, so dense meshes are grouped
 * into patches of about `cellMm`. Every mesh node belongs to the nearest patch
 * centre; a patch's height is the mean of its nodes.
 */
export interface PatchGrid {
  rows: number
  cols: number
  /** Patch index [row, col] of every mesh node. */
  assign: [number, number][][]
  /** Patch size, mm. */
  size: [number, number]
}

export function patchGrid(grid: Grid, cellMm: number): PatchGrid {
  const count = (vals: number[]) => {
    const span = Math.abs(vals[vals.length - 1] - vals[0])
    return Math.min(vals.length, Math.max(2, Math.round(span / Math.max(cellMm, 1)) + 1))
  }
  const cols = count(grid.xs)
  const rows = count(grid.ys)
  const index = (vals: number[], i: number, n: number) =>
    vals.length === n ? i : Math.round((i / (vals.length - 1)) * (n - 1))
  const span = (vals: number[], n: number) => Math.abs(vals[vals.length - 1] - vals[0]) / Math.max(1, n - 1)
  return {
    rows,
    cols,
    assign: grid.ys.map((_, i) => grid.xs.map((__, j) => [index(grid.ys, i, rows), index(grid.xs, j, cols)])),
    size: [span(grid.xs, cols), span(grid.ys, rows)],
  }
}

/** Mean mesh height under each patch. */
export function patchHeights(p: PatchGrid, mesh: number[][]): number[][] {
  const sum = Array.from({ length: p.rows }, () => Array(p.cols).fill(0))
  const n = Array.from({ length: p.rows }, () => Array(p.cols).fill(0))
  mesh.forEach((row, i) =>
    row.forEach((v, j) => {
      const [r, c] = p.assign[i][j]
      sum[r][c] += v
      n[r][c]++
    }),
  )
  return sum.map((row, r) => row.map((v, c) => (n[r][c] ? v / n[r][c] : 0)))
}

/** Raise every mesh node by the tape on its patch. */
export function applyPatches(p: PatchGrid, mesh: number[][], spots: TapeSpot[], thickness: number): number[][] {
  const layers = Array.from({ length: p.rows }, () => Array(p.cols).fill(0))
  for (const s of spots) layers[s.row][s.col] = s.layers
  return mesh.map((row, i) =>
    row.map((v, j) => {
      const [r, c] = p.assign[i][j]
      return v + layers[r][c] * thickness
    }),
  )
}
