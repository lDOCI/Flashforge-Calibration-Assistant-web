import { describe, expect, it } from 'vitest'
import type { MeshData } from './types'
import { gridOf, meshPlane, rangeOf, sample } from './grid'
import { planBelts, planScrews } from './mechanics'
import { planTape } from './tape'
import { computeWorkflow, screwPositions, shaftPositions } from './workflow'
import { KlipperMeshParser, validateMeshData } from '../parsers/meshParser'
import { defaultSettings } from '@/stores/settings'

function meshFrom(f: (x: number, y: number) => number, xCount = 5, yCount = 5, min = -105, max = 105): MeshData {
  const xs = Array.from({ length: xCount }, (_, i) => min + (i * (max - min)) / (xCount - 1))
  const ys = Array.from({ length: yCount }, (_, i) => min + (i * (max - min)) / (yCount - 1))
  return {
    matrix: ys.map(y => xs.map(x => f(x, y))),
    xCount,
    yCount,
    minX: min,
    maxX: max,
    minY: min,
    maxY: max,
  }
}

function cfgFor(m: MeshData): string {
  return [
    '[printer]',
    'kinematics: corexy',
    '#*# <---------------------- SAVE_CONFIG ---------------------->',
    '#*# [bed_mesh default]',
    '#*# version = 1',
    '#*# points =',
    ...m.matrix.map(r => '#*# \t  ' + r.map(v => v.toFixed(6)).join(', ')),
    `#*# x_count = ${m.xCount}`,
    `#*# y_count = ${m.yCount}`,
    '#*# algo = lagrange',
    `#*# min_x = ${m.minX.toFixed(1)}`,
    `#*# max_x = ${m.maxX.toFixed(1)}`,
    `#*# min_y = ${m.minY.toFixed(1)}`,
    `#*# max_y = ${m.maxY.toFixed(1)}`,
    '#*#',
    '#*# [input_shaper]',
    '#*# shaper_freq_x = 50.0',
  ].join('\n')
}

describe('mesh parser', () => {
  it('keeps Klipper row = Y, col = X for non-square meshes', () => {
    const src = meshFrom((x, y) => 0.001 * x + 0.002 * y, 7, 5)
    const parsed = new KlipperMeshParser().parseAllMeshes(cfgFor(src))
    expect(parsed).toHaveLength(1)
    const m = parsed[0].meshData
    expect(m.matrix).toHaveLength(5)
    expect(m.matrix[0]).toHaveLength(7)
    expect(validateMeshData(m)).toBe(true)
    // Following section must not leak into the mesh.
    expect(m.matrix.flat().every(v => Math.abs(v) < 1)).toBe(true)
  })

  it('runs the full workflow on a non-square mesh', () => {
    const m = meshFrom((x, y) => 0.002 * x - 0.001 * y + 0.00002 * x * x, 9, 5)
    const wf = computeWorkflow(m, defaultSettings())
    expect(wf.stages.map(s => s.key)).toEqual(['initial', 'after_belts', 'after_screws', 'after_tape'])
    expect(wf.bestStage.deviation).toBeLessThan(wf.stages[0].deviation)
  })

  it('rejects malformed meshes', () => {
    const m = meshFrom(() => 0)
    expect(validateMeshData({ ...m, xCount: 6 })).toBe(false)
    expect(validateMeshData({ ...m, matrix: m.matrix.map(r => r.map(() => NaN)) })).toBe(false)
  })
})

describe('Z belts', () => {
  const s = defaultSettings()

  it('undoes an exact two-tooth error on one shaft', () => {
    const base = meshFrom(() => 0)
    const grid = gridOf(base, 220, 220)
    const shafts = shaftPositions(grid, s.geometry)
    // Front-left shaft sits 0.8 mm low: plane through (FL=-0.8, FR=0, back=0).
    const tilted = { ...base, matrix: base.matrix }
    const plane = (x: number, y: number) => {
      const [fl, fr, bk] = shafts
      // Solve for a plane through the three shaft heights.
      const det = (fr[0] - fl[0]) * (bk[1] - fl[1]) - (bk[0] - fl[0]) * (fr[1] - fl[1])
      const u = ((x - fl[0]) * (bk[1] - fl[1]) - (bk[0] - fl[0]) * (y - fl[1])) / det
      const v = ((fr[0] - fl[0]) * (y - fl[1]) - (x - fl[0]) * (fr[1] - fl[1])) / det
      return -0.8 * (1 - u - v)
    }
    tilted.matrix = sample(grid, plane)

    const plan = planBelts(grid, tilted.matrix, shafts, 0.4)
    // Only the relative move matters: FL must end up 2 teeth higher than the others.
    expect(plan.teeth.front_left - plan.teeth.front_right).toBe(2)
    expect(plan.teeth.front_left - plan.teeth.back).toBe(2)
    expect(plan.rangeAfter).toBeLessThan(1e-9)
  })

  it('leaves a sub-threshold tilt alone', () => {
    const m = meshFrom(x => 0.0003 * x)
    const wf = computeWorkflow(m, s)
    expect(wf.stages[1].actions).toHaveLength(0)
  })
})

describe('bed screws', () => {
  it('rigid plate: raising one corner moves it 3/4, neighbours 1/4, opposite -1/4', () => {
    // Mesh nodes placed exactly on the four screws.
    const m = meshFrom(() => 0, 2, 2, -105, 105)
    const grid = gridOf(m, 220, 220)
    const corners = screwPositions(grid, defaultSettings().geometry)
    // Ask the solver to cancel a corner that is 1 mm low: the plate cannot twist,
    // so the best it can do leaves the planar residual.
    const low = [[-1, 0], [0, 0]]
    const plan = planScrews(grid, low, corners, { pitch: 0.7, minAdjust: 0, maxAdjust: 10, flex: 0 })
    // Best a rigid plate can do against a single-corner dent is ±0.25 mm.
    expect(plan.rangeAfter).toBeCloseTo(0.5, 1)
  })

  it('removes any pure tilt to within rounding', () => {
    const m = meshFrom((x, y) => 0.0015 * x - 0.001 * y)
    const grid = gridOf(m, 220, 220)
    const corners = screwPositions(grid, defaultSettings().geometry)
    const plan = planScrews(grid, m.matrix, corners, { pitch: 0.7, minAdjust: 0.02, maxAdjust: 2, flex: 0.2 })
    expect(plan.rangeAfter).toBeLessThan(0.03)
    // Lower the high side: +X is high, so right-hand screws go down.
    expect(plan.moves.front_right).toBeLessThan(0)
    expect(plan.moves.back_left).toBeGreaterThan(0)
  })

  it('plans from the post-belt mesh, not the original', () => {
    const s = defaultSettings()
    // Big tilt the belts can fully remove (exactly 3 teeth across the bed).
    const m = meshFrom((_, y) => (-1.2 * (y + 105)) / 210)
    const wf = computeWorkflow(m, s)
    const [, belts, screws] = wf.stages
    expect(belts.actions.length).toBeGreaterThan(0)
    // Whatever the belts leave is small, so the screw stage must not re-correct the full tilt.
    const screwMm = screws.actions.reduce((sum, a) => sum + (a.magnitudeMm ?? 0), 0)
    expect(screwMm).toBeLessThan(0.5)
    expect(screws.deviation).toBeLessThanOrEqual(belts.deviation + 1e-9)
  })
})

describe('tape', () => {
  it('fills a single dip with the right number of layers', () => {
    const m = [
      [0, 0, 0],
      [0, -0.12, 0],
      [0, 0, 0],
    ]
    const plan = planTape(m, { thickness: 0.06, maxLayers: 4, minDepth: 0.03 })
    expect(plan.spots).toEqual([{ row: 1, col: 1, layers: 2, depth: 0.12 }])
    expect(plan.rangeAfter).toBeLessThan(1e-9)
  })

  it('never makes things worse', () => {
    const m = [
      [0.01, -0.02, 0.0],
      [0.02, 0.0, -0.01],
    ]
    const plan = planTape(m, { thickness: 0.06, maxLayers: 4, minDepth: 0.03 })
    expect(plan.rangeAfter).toBeLessThanOrEqual(rangeOf(m))
  })
})

describe('workflow', () => {
  it('each stage starts where the previous one ended', () => {
    const m = meshFrom((x, y) => 0.004 * x + 0.002 * y + (x * y > 0 ? 0.05 : -0.05))
    const wf = computeWorkflow(m, defaultSettings())
    for (let i = 1; i < wf.stages.length; i++) {
      expect(wf.stages[i].baseline).toBeCloseTo(wf.stages[i - 1].deviation, 9)
    }
  })

  it('reports the flatness floor (range after removing the best plane)', () => {
    const m = meshFrom((x, y) => 0.003 * x + 0.001 * y)
    const wf = computeWorkflow(m, defaultSettings())
    expect(wf.flatnessFloor).toBeLessThan(1e-9)
    const g = gridOf(m, 220, 220)
    expect(rangeOf(meshPlane(g, m.matrix))).toBeCloseTo(wf.stages[0].deviation, 9)
  })
})

describe('cell labels', () => {
  it('labels cells chess-style: column letter + row from the front', async () => {
    const { cellLabel } = await import('./workflow')
    expect(cellLabel(0, 0, 5)).toBe('A1')
    expect(cellLabel(4, 4, 5)).toBe('E5')
    expect(cellLabel(1, 1, 5)).toBe('B2')
    expect(cellLabel(28, 29, 40)).toBe('30:29')
  })
})

describe('tape on dense meshes', () => {
  it('groups a 31×31 mesh into ~40 mm patches', () => {
    const m = meshFrom((x, y) => -0.2 * Math.exp(-((x - 40) ** 2 + (y + 30) ** 2) / 2000), 31, 31)
    const wf = computeWorkflow(m, { ...defaultSettings(), workflow: { enable_belt: false, enable_screws: false, enable_tape: true } })
    const tape = wf.stages[3]
    expect(tape.metadata.tape_cols).toBe(6)
    expect(tape.actions.length).toBeGreaterThan(0)
    expect(tape.actions.length).toBeLessThanOrEqual(36)
    expect(tape.deviation).toBeLessThan(tape.baseline!)
  })
})

describe('tape cell matches the corner it came from', () => {
  // Klipper writes points row by row starting at min_y (front), each row from min_x (left).
  // So the FIRST number of the FIRST points row is the front-left probe point.
  const cfgWithDip = (row: number, col: number) => {
    const rows = Array.from({ length: 5 }, (_, r) =>
      '#*# \t  ' + Array.from({ length: 5 }, (_, c) => (r === row && c === col ? -0.2 : 0).toFixed(6)).join(', '),
    )
    return ['#*# [bed_mesh default]', '#*# points =', ...rows, '#*# x_count = 5', '#*# y_count = 5',
      '#*# min_x = -105.0', '#*# max_x = 105.0', '#*# min_y = -105.0', '#*# max_y = 105.0'].join('\n')
  }
  const tapeFor = (row: number, col: number) => {
    const mesh = new KlipperMeshParser().parseAllMeshes(cfgWithDip(row, col))[0].meshData
    const s = { ...defaultSettings(), workflow: { enable_belt: false, enable_screws: false, enable_tape: true } }
    return computeWorkflow(mesh, s).stages[3].actions.map(a => a.identifier)
  }

  it.each([
    [0, 0, 'A1'], // first value of first row → front-left
    [0, 4, 'E1'], // last value of first row → front-right
    [4, 0, 'A5'], // first value of last row → back-left
    [4, 4, 'E5'], // last value of last row → back-right
  ])('dip at points row %i, value %i → %s', (row, col, label) => {
    expect(tapeFor(row, col)).toEqual([label])
  })
})
