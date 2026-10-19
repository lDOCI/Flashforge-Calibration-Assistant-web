/**
 * Mechanical model of the Adventurer 5M bed.
 *
 * - The bed carriage rides on three Z lead screws (T8, 8 mm lead) linked by one
 *   belt over 20T pulleys: front-left, front-right and back-center. Moving the
 *   belt by one tooth on one pulley moves that lead screw by 8 / 20 = 0.4 mm.
 *   Three points define a plane, so the carriage simply tilts.
 * - The heater plate sits on four springs over load cells, one nut/screw per
 *   corner. A stiff plate on four soft springs settles on the least-squares
 *   plane through the four support heights; a flexible plate follows each
 *   corner on its own. `bed_flex` blends the two.
 *
 * Mesh values follow Klipper: a higher value means the bed surface is higher
 * at that point. Every function here works in mm and printer coordinates.
 */
import type { CornerId, Point, ShaftId } from './types'
import {
  type Grid,
  addScaled,
  fitPlane,
  leastSquares,
  meshPlaneFn,
  rangeOf,
  sample,
} from './grid'

export const SHAFTS: ShaftId[] = ['front_left', 'front_right', 'back']
export const CORNERS: CornerId[] = ['front_left', 'front_right', 'back_left', 'back_right']

// ---------- support responses ----------

/** Height change at every node when support `k` moves by 1 mm and the others stay put. */
function planarResponses(grid: Grid, supports: Point[]): number[][][] {
  return supports.map((_, k) => {
    const unit = supports.map((__, i) => (i === k ? 1 : 0))
    return sample(grid, fitPlane(supports, unit))
  })
}

/** Bilinear response of four corner supports ordered FL, FR, BL, BR. */
function bilinearResponses(grid: Grid, corners: Point[]): number[][][] {
  const [fl, fr, bl] = corners
  const x0 = fl[0]
  const x1 = fr[0]
  const y0 = fl[1]
  const y1 = bl[1]
  const weights = [
    (u: number, v: number) => (1 - u) * (1 - v),
    (u: number, v: number) => u * (1 - v),
    (u: number, v: number) => (1 - u) * v,
    (u: number, v: number) => u * v,
  ]
  return weights.map(w =>
    sample(grid, (x, y) => w((x - x0) / (x1 - x0), (y - y0) / (y1 - y0))),
  )
}

function applyMoves(mesh: number[][], responses: number[][][], moves: number[]): number[][] {
  let out = mesh
  moves.forEach((d, k) => {
    if (d !== 0) out = addScaled(out, responses[k], d)
  })
  return out
}

// ---------- belts (Z lead screws) ----------

export interface BeltPlan {
  /** Teeth per shaft; positive raises the bed at that shaft. */
  teeth: Record<ShaftId, number>
  meshAfter: number[][]
  rangeBefore: number
  rangeAfter: number
}

/**
 * Pick whole-tooth moves for the three lead screws that best flatten the mesh.
 *
 * The ideal (continuous) move is the one that cancels the best-fit plane, i.e.
 * `-plane(shaft)` at each shaft. Teeth are discrete, so every floor/ceil
 * combination is tried and the one with the smallest resulting range wins.
 * Moving all three by the same amount only shifts Z (re-homed anyway), so the
 * result is normalised to keep the median shaft still.
 */
export function planBelts(grid: Grid, mesh: number[][], shafts: Point[], toothMm: number): BeltPlan {
  const responses = planarResponses(grid, shafts)
  const plane = meshPlaneFn(grid, mesh)
  const ideal = shafts.map(([x, y]) => -plane(x, y) / toothMm)

  const rangeBefore = rangeOf(mesh)
  let best = { teeth: [0, 0, 0], range: rangeBefore, cost: 0 }

  for (let mask = 0; mask < 8; mask++) {
    const raw = ideal.map((v, k) => ((mask >> k) & 1 ? Math.ceil(v) : Math.floor(v)))
    const median = [...raw].sort((a, b) => a - b)[1]
    const teeth = raw.map(n => n - median)
    const range = rangeOf(applyMoves(mesh, responses, teeth.map(n => n * toothMm)))
    const cost = teeth.reduce((s, n) => s + Math.abs(n), 0)
    if (range < best.range - 1e-9 || (Math.abs(range - best.range) < 1e-9 && cost < best.cost)) {
      best = { teeth, range, cost }
    }
  }

  return {
    teeth: { front_left: best.teeth[0], front_right: best.teeth[1], back: best.teeth[2] },
    meshAfter: applyMoves(mesh, responses, best.teeth.map(n => n * toothMm)),
    rangeBefore,
    rangeAfter: best.range,
  }
}

// ---------- bed screws ----------

export interface ScrewOptions {
  pitch: number
  minAdjust: number
  maxAdjust: number
  flex: number
}

export interface ScrewPlan {
  /** Height change per corner, mm; positive raises that corner. Already rounded to whole minutes. */
  moves: Record<CornerId, number>
  /** Clock minutes per corner (60' = one full turn). */
  minutes: Record<CornerId, number>
  limited: CornerId[]
  meshAfter: number[][]
  rangeBefore: number
  rangeAfter: number
}

/**
 * Least-squares screw moves with a small penalty on the moves themselves, so
 * the solver prefers small turns split between corners. The common offset is
 * free (it only shifts Z). Moves below `minAdjust` are dropped and moves over
 * `maxAdjust` are clamped, re-solving the rest each time.
 */
export function planScrews(grid: Grid, mesh: number[][], corners: Point[], opts: ScrewOptions): ScrewPlan {
  const rigid = planarResponses(grid, corners)
  const flexible = bilinearResponses(grid, corners)
  const k = Math.min(1, Math.max(0, opts.flex))
  const responses = rigid.map((r, i) =>
    r.map((row, a) => row.map((v, b) => (1 - k) * v + k * flexible[i][a][b])),
  )

  const flat = (m: number[][]) => m.flat()
  const cols = responses.map(flat)
  const target = flat(mesh).map(v => -v)
  const nodes = target.length

  const fixed: (number | null)[] = [null, null, null, null]
  const limited = new Set<number>()
  let moves = [0, 0, 0, 0]

  for (let iter = 0; iter < 5; iter++) {
    const free = fixed.map((f, i) => (f === null ? i : -1)).filter(i => i >= 0)
    const b = target.map((v, r) =>
      v - fixed.reduce<number>((s, f, i) => s + (f ?? 0) * cols[i][r], 0),
    )
    const A = b.map((_, r) => [...free.map(i => cols[i][r]), 1])
    const ridge = [...free.map(() => 1e-3 * nodes), 0]
    const sol = free.length > 0 ? leastSquares(A, b, ridge) : []

    moves = fixed.map(f => f ?? 0)
    free.forEach((i, n) => (moves[i] = sol[n]))

    let changed = false
    for (const i of free) {
      if (Math.abs(moves[i]) > opts.maxAdjust) {
        fixed[i] = Math.sign(moves[i]) * opts.maxAdjust
        limited.add(i)
        changed = true
      } else if (Math.abs(moves[i]) < opts.minAdjust) {
        fixed[i] = 0
        changed = true
      }
    }
    if (!changed) break
    moves = fixed.map((f, i) => f ?? moves[i])
  }

  const mmPerMinute = opts.pitch / 60
  const minutes = moves.map(d => Math.round(Math.abs(d) / mmPerMinute))
  const rounded = moves.map((d, i) => Math.sign(d) * minutes[i] * mmPerMinute)
  const meshAfter = applyMoves(mesh, responses, rounded)

  const byCorner = <T>(vals: T[]) =>
    Object.fromEntries(CORNERS.map((c, i) => [c, vals[i]])) as Record<CornerId, T>

  return {
    moves: byCorner(rounded),
    minutes: byCorner(minutes),
    limited: [...limited].map(i => CORNERS[i]),
    meshAfter,
    rangeBefore: rangeOf(mesh),
    rangeAfter: rangeOf(meshAfter),
  }
}
