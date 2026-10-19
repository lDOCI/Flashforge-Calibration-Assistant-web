import type { MeshData, Point } from './types'

/**
 * Physical layout of a mesh: where each node sits on the bed, in mm.
 * `xs[col]` and `ys[row]` follow Klipper's `matrix[row][col]` layout.
 */
export interface Grid {
  rows: number
  cols: number
  xs: number[]
  ys: number[]
  /** Bed center in printer coordinates, mm. */
  center: Point
}

function axis(min: number, max: number, count: number): number[] {
  if (count <= 1) return [min]
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => min + i * step)
}

/**
 * Build the node layout of a mesh. Klipper printers use either a corner origin
 * (0..size) or a center origin (-size/2..size/2); a negative mesh bound means
 * the latter.
 */
export function gridOf(mesh: MeshData, bedSizeX: number, bedSizeY: number): Grid {
  const centered = mesh.minX < 0 || mesh.minY < 0
  return {
    rows: mesh.yCount,
    cols: mesh.xCount,
    xs: axis(mesh.minX, mesh.maxX, mesh.xCount),
    ys: axis(mesh.minY, mesh.maxY, mesh.yCount),
    center: centered ? [0, 0] : [bedSizeX / 2, bedSizeY / 2],
  }
}

/** Absolute position of a point given relative to the bed center. */
export function fromCenter(grid: Grid, [dx, dy]: Point): Point {
  return [grid.center[0] + dx, grid.center[1] + dy]
}

export function copyMatrix(m: number[][]): number[][] {
  return m.map(row => [...row])
}

export function rangeOf(m: number[][]): number {
  let lo = Infinity
  let hi = -Infinity
  for (const row of m) {
    for (const v of row) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  return hi - lo
}

export function meanOf(m: number[][]): number {
  let sum = 0
  let n = 0
  for (const row of m) {
    for (const v of row) {
      sum += v
      n++
    }
  }
  return n === 0 ? 0 : sum / n
}

/** `a + k * b`, element-wise. */
export function addScaled(a: number[][], b: number[][], k = 1): number[][] {
  return a.map((row, i) => row.map((v, j) => v + k * b[i][j]))
}

/** Evaluate `f(x, y)` at every node of the grid. */
export function sample(grid: Grid, f: (x: number, y: number) => number): number[][] {
  return grid.ys.map(y => grid.xs.map(x => f(x, y)))
}

/**
 * Solve `min ||A·x - b||² + Σ ridge[k]·x[k]²` via normal equations.
 * Problems here have at most a handful of unknowns, so this is plenty.
 */
export function leastSquares(A: number[][], b: number[], ridge: number[] = []): number[] {
  const p = A[0]?.length ?? 0
  const M = Array.from({ length: p }, () => Array(p + 1).fill(0))
  for (let r = 0; r < A.length; r++) {
    for (let i = 0; i < p; i++) {
      M[i][p] += A[r][i] * b[r]
      for (let j = 0; j < p; j++) M[i][j] += A[r][i] * A[r][j]
    }
  }
  for (let i = 0; i < p; i++) M[i][i] += ridge[i] ?? 0

  for (let col = 0; col < p; col++) {
    let pivot = col
    for (let r = col + 1; r < p; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    const d = M[col][col]
    if (Math.abs(d) < 1e-12) continue
    for (let r = 0; r < p; r++) {
      if (r === col) continue
      const f = M[r][col] / d
      for (let c = col; c <= p; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[p] / row[i]))
}

/** Least-squares plane `z = a + b·x + c·y` through the given points. */
export function fitPlane(points: Point[], values: number[]): (x: number, y: number) => number {
  const A = points.map(([x, y]) => [1, x, y])
  const [a, b, c] = leastSquares(A, values)
  return (x, y) => a + b * x + c * y
}

/** Best-fit plane of a mesh as a function of printer coordinates. */
export function meshPlaneFn(grid: Grid, m: number[][]): (x: number, y: number) => number {
  const pts: Point[] = []
  const vals: number[] = []
  for (let i = 0; i < grid.rows; i++) {
    for (let j = 0; j < grid.cols; j++) {
      pts.push([grid.xs[j], grid.ys[i]])
      vals.push(m[i][j])
    }
  }
  return fitPlane(pts, vals)
}

/** Best-fit plane of a mesh, sampled back onto its nodes. */
export function meshPlane(grid: Grid, m: number[][]): number[][] {
  return sample(grid, meshPlaneFn(grid, m))
}

/** Bilinear resample of `m` (on grid `from`) onto the nodes of grid `to`. */
export function resample(from: Grid, m: number[][], to: Grid): number[][] {
  const locate = (axisVals: number[], v: number): [number, number] => {
    const n = axisVals.length
    if (n === 1) return [0, 0]
    const t = ((v - axisVals[0]) / (axisVals[n - 1] - axisVals[0])) * (n - 1)
    const i = Math.min(n - 2, Math.max(0, Math.floor(t)))
    return [i, Math.min(1, Math.max(0, t - i))]
  }
  return sample(to, (x, y) => {
    const [j, u] = locate(from.xs, x)
    const [i, v] = locate(from.ys, y)
    const j1 = Math.min(j + 1, from.cols - 1)
    const i1 = Math.min(i + 1, from.rows - 1)
    return (
      m[i][j] * (1 - u) * (1 - v) +
      m[i][j1] * u * (1 - v) +
      m[i1][j] * (1 - u) * v +
      m[i1][j1] * u * v
    )
  })
}
