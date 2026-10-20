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
 * `planTape` works on whatever grid it is given; the workflow hands it the
 * stencil cell heights (see `patchGrid`), not raw meshes. A spring-steel sheet
 * bridges small gaps, which smooths the real result slightly.
 */
import { type Grid, rangeOf } from './grid'
import { CELL_MM, STENCIL, cellIndex } from './stencil'

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

export function planTape(heights: number[][], opts: TapeOptions): TapePlan {
  // Empty cells (NaN) are treated as the highest point: never taped, never limiting.
  const top = Math.max(...heights.flat().filter(Number.isFinite))
  const mesh = heights.map(row => row.map(v => (Number.isFinite(v) ? v : top)))
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
 * Tape is planned on the cells of the universal printed stencil (see
 * stencil.ts), so "C1, 2 layers" always means the same window. Every mesh
 * node belongs to the stencil cell it lies in; a cell's height is the mean
 * of its nodes. Cells with no nodes (mesh smaller than the bed) are never taped.
 */
export interface PatchGrid {
  rows: number
  cols: number
  /** Cell index [row, col] of every mesh node. */
  assign: [number, number][][]
  /** Cell size, mm. */
  size: [number, number]
}

export function patchGrid(grid: Grid): PatchGrid {
  const [cx, cy] = grid.center
  return {
    rows: STENCIL.cells,
    cols: STENCIL.cells,
    assign: grid.ys.map(y => grid.xs.map(x => [cellIndex(y - cy), cellIndex(x - cx)] as [number, number])),
    size: [CELL_MM, CELL_MM],
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
  return sum.map((row, r) => row.map((v, c) => (n[r][c] ? v / n[r][c] : NaN)))
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
