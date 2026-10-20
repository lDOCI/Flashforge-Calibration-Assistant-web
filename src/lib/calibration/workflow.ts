/**
 * Belts → screws → tape. Each stage plans against the mesh the previous stage
 * predicts, never against the original measurement.
 */
import type {
  CalibrationSettings,
  CornerId,
  MeshData,
  Point,
  StageAction,
  StageKey,
  StageResult,
  WorkflowData,
} from './types'
import { type Grid, addScaled, copyMatrix, fromCenter, gridOf, meshPlane, rangeOf } from './grid'
import { CORNERS, SHAFTS, planBelts, planScrews } from './mechanics'
import { applyPatches, patchGrid, patchHeights, planTape } from './tape'

const CORNER_LABEL: Record<string, string> = {
  front_left: 'visual_rec.front_left',
  front_right: 'visual_rec.front_right',
  back_left: 'visual_rec.back_left',
  back_right: 'visual_rec.back_right',
  back: 'visual_rec.back_center',
}

const STAGE_TEXT: Record<Exclude<StageKey, 'initial'>, { label: string; description: string; help: string; none: string }> = {
  after_belts: {
    label: 'visual_rec.belt_stage_title',
    description: 'visual_rec.belt_stage_description',
    help: 'visual_rec.help.belts',
    none: 'visual_rec.belt_no_adjustments',
  },
  after_screws: {
    label: 'visual_rec.screw_header',
    description: 'visual_rec.stage_screw_details',
    help: 'visual_rec.help.screws',
    none: 'visual_rec.screw_no_adjustments',
  },
  after_tape: {
    label: 'visual_rec.tape_header',
    description: 'visual_rec.stage_tape_details',
    help: 'visual_rec.help.tape',
    none: 'visual_rec.tape_no_adjustments',
  },
}

/**
 * Chess-style label of a cell: letter = column from the left, number = row
 * from the front. "A1" is front-left, "E5" back-right on a 5×5 grid.
 * Grids wider than 26 columns run out of letters and use "column:row".
 */
export function cellLabel(row: number, col: number, cols: number): string {
  return cols <= 26 ? `${String.fromCharCode(65 + col)}${row + 1}` : `${col + 1}:${row + 1}`
}

function stage(
  key: Exclude<StageKey, 'initial'>,
  before: number[][],
  after: number[][],
  actions: StageAction[],
  extra: { enabled?: boolean; warnings?: string[]; metadata?: Record<string, unknown> } = {},
): StageResult {
  const text = STAGE_TEXT[key]
  const enabled = extra.enabled ?? true
  const warnings = extra.warnings ?? []
  if (!enabled) warnings.unshift('visual_rec.stage_disabled')
  else if (actions.length === 0) warnings.unshift(text.none)
  return {
    key,
    label: text.label,
    description: text.description,
    enabled,
    deviation: rangeOf(after),
    baseline: rangeOf(before),
    mesh: copyMatrix(after),
    actions,
    warnings,
    helpKey: text.help,
    metadata: extra.metadata ?? {},
  }
}

function skipped(key: Exclude<StageKey, 'initial'>, mesh: number[][]): [StageResult, number[][]] {
  return [stage(key, mesh, mesh, [], { enabled: false }), mesh]
}

export function shaftPositions(grid: Grid, g: CalibrationSettings['geometry']): Point[] {
  return [g.shaft_front_left, g.shaft_front_right, g.shaft_back].map(p => fromCenter(grid, p))
}

export function screwPositions(grid: Grid, g: CalibrationSettings['geometry']): Point[] {
  const sx = g.screw_offset_x
  const sy = g.screw_offset_y
  const rel: Point[] = [[-sx, -sy], [sx, -sy], [-sx, sy], [sx, sy]]
  return rel.map(p => fromCenter(grid, p))
}

export function buildBeltStage(
  grid: Grid,
  mesh: number[][],
  s: CalibrationSettings,
): [StageResult, number[][]] {
  if (!s.workflow.enable_belt) return skipped('after_belts', mesh)

  const plan = planBelts(grid, mesh, shaftPositions(grid, s.geometry), s.hardware.belt_tooth_mm)
  const gain = plan.rangeBefore - plan.rangeAfter
  if (gain < s.thresholds.belt_threshold) {
    return [stage('after_belts', mesh, mesh, []), mesh]
  }

  const actions: StageAction[] = SHAFTS.filter(id => plan.teeth[id] !== 0).map(id => {
    const n = plan.teeth[id]
    return {
      kind: 'belt',
      identifier: id,
      label: CORNER_LABEL[id],
      direction: n > 0 ? 'up' : 'down',
      teeth: Math.abs(n),
      magnitudeMm: Math.abs(n) * s.hardware.belt_tooth_mm,
      metadata: {},
    }
  })
  return [stage('after_belts', mesh, plan.meshAfter, actions), plan.meshAfter]
}

export function buildScrewStage(
  grid: Grid,
  mesh: number[][],
  s: CalibrationSettings,
): [StageResult, number[][]] {
  if (!s.workflow.enable_screws) return skipped('after_screws', mesh)

  const h = s.hardware
  const plan = planScrews(grid, mesh, screwPositions(grid, s.geometry), {
    pitch: h.screw_pitch,
    minAdjust: h.min_adjustment,
    maxAdjust: h.max_adjustment,
  })
  if (plan.rangeBefore - plan.rangeAfter < s.thresholds.screw_threshold) {
    return [stage('after_screws', mesh, mesh, []), mesh]
  }

  const actions: StageAction[] = CORNERS.filter((c: CornerId) => plan.minutes[c] > 0).map(c => ({
    kind: 'screw',
    identifier: c,
    label: CORNER_LABEL[c],
    // Holding the nut, clockwise drives the screw in and pulls that corner down.
    direction: plan.moves[c] < 0 ? 'clockwise' : 'counterclockwise',
    minutes: plan.minutes[c],
    degrees: plan.minutes[c] * 6,
    magnitudeMm: Math.abs(plan.moves[c]),
    metadata: { turns: plan.minutes[c] / 60 },
  }))
  const warnings = plan.limited.length > 0 ? ['visual_rec.screw_limit'] : []
  return [stage('after_screws', mesh, plan.meshAfter, actions, { warnings }), plan.meshAfter]
}

export function buildTapeStage(
  grid: Grid,
  mesh: number[][],
  s: CalibrationSettings,
): [StageResult, number[][]] {
  if (!s.workflow.enable_tape) return skipped('after_tape', mesh)

  const t = s.hardware.tape_thickness
  const patches = patchGrid(grid)
  const plan = planTape(patchHeights(patches, mesh), {
    thickness: t,
    maxLayers: s.hardware.max_tape_layers,
    minDepth: s.thresholds.tape_threshold,
  })
  const meshAfter = applyPatches(patches, mesh, plan.spots, t)
  // Taping is fiddly; skip it unless it removes at least half a layer of error.
  if (rangeOf(mesh) - rangeOf(meshAfter) < t / 2) {
    return [stage('after_tape', mesh, mesh, []), mesh]
  }

  const actions: StageAction[] = plan.spots.map(spot => {
    const id = cellLabel(spot.row, spot.col, patches.cols)
    return {
      kind: 'tape',
      identifier: id,
      label: id,
      magnitudeMm: spot.depth,
      metadata: { layers: spot.layers, thickness: spot.layers * t, row: spot.row, col: spot.col },
    }
  })
  return [
    stage('after_tape', mesh, meshAfter, actions, {
      metadata: {
        patch_mm: patches.size.map(Math.round),
        tape_rows: patches.rows,
        tape_cols: patches.cols,
      },
    }),
    meshAfter,
  ]
}

export function computeWorkflow(meshData: MeshData, s: CalibrationSettings): WorkflowData {
  const grid = gridOf(meshData, s.geometry.bed_size_x, s.geometry.bed_size_y)
  const original = copyMatrix(meshData.matrix)

  const initial: StageResult = {
    key: 'initial',
    label: 'visual_rec.stage_initial',
    description: 'visual_rec.stage_initial_details',
    enabled: true,
    deviation: rangeOf(original),
    baseline: null,
    mesh: copyMatrix(original),
    actions: [],
    warnings: [],
    helpKey: 'visual_rec.help.initial',
    metadata: {},
  }

  const [belts, afterBelts] = buildBeltStage(grid, original, s)
  const [screws, afterScrews] = buildScrewStage(grid, afterBelts, s)
  const [tape] = buildTapeStage(grid, afterScrews, s)

  const stages = [initial, belts, screws, tape]
  const bestStage = stages
    .filter(st => st.enabled)
    .reduce((best, st) => (st.deviation < best.deviation ? st : best))

  return {
    stages,
    bestStage,
    flatnessFloor: rangeOf(addScaled(original, meshPlane(grid, original), -1)),
  }
}
