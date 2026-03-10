import type {
  StageAction,
  StageResult,
  WorkflowData,
  ScrewAdjustment,
  TapeSpot,
  CalibrationSettings,
} from './types'
import { Bed } from './bed'
import { ScrewSolver } from './screwSolver'
import { DeviationAnalyzer } from './deviationAnalyzer'
import { TapeCalculator } from './tapeCalculator'
import { copyMatrix, zerosMatrix, mean2D, max2D, min2D, linspace } from '../utils'

// Tunable gains for front vs rear Z-shafts
const FRONT_SHAFT_GAIN = 1.6
const BACK_SHAFT_GAIN = 0.4

// ---------- helpers ----------

export function computeStageDeviation(mesh: number[][]): number {
  return max2D(mesh) - min2D(mesh)
}

function formatCornerName(side: string): string {
  const mapping: Record<string, string> = {
    front_left: 'visual_rec.front_left',
    front_right: 'visual_rec.front_right',
    back_left: 'visual_rec.back_left',
    back_right: 'visual_rec.back_right',
    back_center: 'visual_rec.back_center',
  }
  return mapping[side] ?? side
}

function normaliseMeshLoad(
  baseMesh: number[][],
  adjustedMesh: number[][],
): number[][] {
  const rows = adjustedMesh.length
  const cols = adjustedMesh[0].length
  let sum = 0
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      sum += adjustedMesh[i][j] - baseMesh[i][j]
  const offset = sum / (rows * cols)

  if (Math.abs(offset) < 1e-9) return adjustedMesh

  const result = copyMatrix(adjustedMesh)
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      result[i][j] -= offset
  return result
}

// ---------- corner weight construction ----------

function buildCornerWeights(
  solver: ScrewSolver,
): Record<string, number[][]> {
  if (
    solver.cornerWeights &&
    Object.keys(solver.cornerWeights).length > 0
  ) {
    return solver.cornerWeights
  }

  const rows = solver.bed.config.meshPointsX
  const cols = solver.bed.config.meshPointsY
  const coords: Record<string, [number, number]> = {
    front_left: [0, 0],
    front_right: [0, cols - 1],
    back_left: [rows - 1, 0],
    back_right: [rows - 1, cols - 1],
  }

  const verticalBias = linspace(1.0, 0.4, rows)
  const horizontalLeft = linspace(1.0, 0.6, cols)
  const horizontalRight = [...horizontalLeft].reverse()

  const weights: Record<string, number[][]> = {}
  for (const [key, [x0, y0]] of Object.entries(coords)) {
    const w = zerosMatrix(rows, cols)
    for (let x = 0; x < rows; x++) {
      for (let y = 0; y < cols; y++) {
        const dist = Math.hypot(x - x0, y - y0)
        const falloff = 1.0 / (1.0 + dist)
        if (key === 'front_left' || key === 'front_right') {
          const horizBias = key === 'front_left' ? horizontalLeft[y] : horizontalRight[y]
          w[x][y] = falloff * verticalBias[x] * horizBias
        } else {
          w[x][y] = falloff * 0.7
        }
      }
    }
    const maxVal = Math.max(...w.flat())
    if (maxVal) {
      for (let x = 0; x < rows; x++)
        for (let y = 0; y < cols; y++)
          w[x][y] /= maxVal
    }
    weights[key] = w
  }
  return weights
}

// ---------- belt stage ----------

function calculateBeltAdjustments(
  bed: Bed,
  solver: ScrewSolver,
  threshold: number,
  toothMm: number,
): Record<string, StageAction> {
  const mesh = bed.meshData!
  const rows = mesh.length
  const cols = mesh[0].length

  const leftFront = mesh[0][0]
  const rightFront = mesh[0][cols - 1]
  const backCenter = mesh[rows - 1][Math.floor(cols / 2)]
  const frontAvg = (leftFront + rightFront) / 2.0

  const adjustments: Record<string, StageAction> = {}

  const lrDiff = rightFront - leftFront
  if (Math.abs(lrDiff) > threshold) {
    const teeth = Math.max(1, Math.ceil(Math.abs(lrDiff) / toothMm))
    const deltaMm = teeth * toothMm
    const targetCorner = lrDiff > 0 ? 'front_left' : 'front_right'
    adjustments[targetCorner] = {
      kind: 'belt',
      identifier: targetCorner,
      label: formatCornerName(targetCorner),
      direction: 'up',
      magnitudeMm: deltaMm,
      teeth,
      metadata: {
        sign: 1.0,
        gain: FRONT_SHAFT_GAIN,
        raw_difference: lrDiff,
        load_bias: 'front',
      },
    }
  }

  const backDiff = backCenter - frontAvg
  if (Math.abs(backDiff) > threshold) {
    const teeth = Math.max(1, Math.ceil(Math.abs(backDiff) / toothMm))
    const deltaMm = teeth * toothMm
    const direction = backDiff < 0 ? 'up' : 'down'
    const sign = direction === 'up' ? 1.0 : -1.0
    adjustments['back'] = {
      kind: 'belt',
      identifier: 'back',
      label: formatCornerName('back_center'),
      direction,
      magnitudeMm: deltaMm,
      teeth,
      metadata: {
        sign,
        gain: BACK_SHAFT_GAIN,
        raw_difference: backDiff,
        load_bias: 'support',
      },
    }
  }

  return adjustments
}

function applyBeltAdjustments(
  baseMesh: number[][],
  solver: ScrewSolver,
  actions: Record<string, StageAction>,
): number[][] {
  if (Object.keys(actions).length === 0) return copyMatrix(baseMesh)

  const weights = buildCornerWeights(solver)
  let result = copyMatrix(baseMesh)

  const applyToCorner = (deltaMm: number, influence: number[][]) => {
    const maxInf = Math.max(...influence.flat())
    const scaled = maxInf
      ? influence.map(row => row.map(v => v / maxInf))
      : influence
    const rows = result.length
    const cols = result[0].length
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++)
        result[i][j] += deltaMm * scaled[i][j]
  }

  for (const [identifier, action] of Object.entries(actions)) {
    let influence: number[][] | undefined
    if (identifier === 'front_left') influence = weights['front_left']
    else if (identifier === 'front_right') influence = weights['front_right']
    else if (identifier === 'back') {
      const bl = weights['back_left']
      const br = weights['back_right']
      if (bl && br) {
        influence = bl.map((row, i) => row.map((v, j) => (v + br[i][j]) / 2.0))
      }
    }
    if (!influence) continue

    const delta =
      (action.magnitudeMm ?? 0) *
      (action.metadata['sign'] as number ?? 1.0) *
      (action.metadata['gain'] as number ?? 1.0)
    applyToCorner(delta, influence)
  }

  const balanced = normaliseMeshLoad(baseMesh, result)
  return balanced
}

export function buildBeltStage(
  bed: Bed,
  solver: ScrewSolver,
  settings: CalibrationSettings,
  meshBefore: number[][],
  enabledFlag: boolean,
): [StageResult, number[][]] {
  const baseline = computeStageDeviation(meshBefore)

  if (!enabledFlag) {
    return [
      {
        key: 'after_belts',
        label: 'visual_rec.belt_stage_title',
        description: 'visual_rec.belt_stage_description',
        enabled: false,
        deviation: baseline,
        baseline,
        mesh: copyMatrix(meshBefore),
        actions: [],
        warnings: ['visual_rec.stage_disabled'],
        helpKey: 'visual_rec.help.belts',
        metadata: {},
      },
      meshBefore,
    ]
  }

  const beltThreshold = settings.thresholds.belt_threshold ?? settings.thresholds.screw_threshold
  const toothMm = settings.hardware.belt_tooth_mm ?? 0.4

  const actionsDict = calculateBeltAdjustments(bed, solver, beltThreshold, toothMm)
  const meshAfter = applyBeltAdjustments(meshBefore, solver, actionsDict)
  const deviationAfter = computeStageDeviation(meshAfter)

  const actions: StageAction[] = []
  for (const k of ['front_left', 'front_right', 'back']) {
    if (actionsDict[k]) actions.push(actionsDict[k])
  }
  const warnings = actions.length === 0 ? ['visual_rec.belt_no_adjustments'] : []

  return [
    {
      key: 'after_belts',
      label: 'visual_rec.belt_stage_title',
      description: 'visual_rec.belt_stage_description',
      enabled: true,
      deviation: deviationAfter,
      baseline,
      mesh: copyMatrix(meshAfter),
      actions,
      warnings,
      helpKey: 'visual_rec.help.belts',
      metadata: {},
    },
    meshAfter,
  ]
}

// ---------- screw stage ----------

function buildScrewActions(adjustments: ScrewAdjustment[]): StageAction[] {
  return adjustments.map(adj => ({
    kind: 'screw',
    identifier: adj.corner,
    label: formatCornerName(adj.corner),
    direction: adj.direction === 'counterclockwise' ? 'counterclockwise' : 'clockwise',
    minutes: adj.minutes,
    degrees: adj.degrees,
    magnitudeMm: Math.abs(adj.currentHeight - adj.targetHeight),
    metadata: { turns: adj.turns },
  }))
}

export function buildScrewStage(
  analyzer: DeviationAnalyzer,
  solver: ScrewSolver,
  baseMesh: number[][],
  enabledFlag: boolean,
): [StageResult, number[][]] {
  const baseline = computeStageDeviation(baseMesh)

  if (!enabledFlag) {
    return [
      {
        key: 'after_screws',
        label: 'visual_rec.screw_header',
        description: 'visual_rec.stage_screw_details',
        enabled: false,
        deviation: baseline,
        baseline,
        mesh: copyMatrix(baseMesh),
        actions: [],
        warnings: ['visual_rec.stage_disabled'],
        helpKey: 'visual_rec.help.screws',
        metadata: {},
      },
      baseMesh,
    ]
  }

  const adjustments = solver.calculateAdjustments(analyzer.getIdealPlane())
  const meshAfter = adjustments.length > 0
    ? solver.simulateSequence(adjustments, baseMesh)
    : copyMatrix(baseMesh)

  const deviationAfter = computeStageDeviation(meshAfter)
  const actions = buildScrewActions(adjustments)
  const warnings = actions.length === 0 ? ['visual_rec.screw_no_adjustments'] : []

  return [
    {
      key: 'after_screws',
      label: 'visual_rec.screw_header',
      description: 'visual_rec.stage_screw_details',
      enabled: true,
      deviation: deviationAfter,
      baseline,
      mesh: copyMatrix(meshAfter),
      actions,
      warnings,
      helpKey: 'visual_rec.help.screws',
      metadata: {},
    },
    meshAfter,
  ]
}

// ---------- tape stage ----------

function buildTapeActions(spots: TapeSpot[], tapeThickness: number): StageAction[] {
  return spots.map(spot => {
    const position = `${spot.x + 1}${String.fromCharCode(65 + spot.y)}`
    return {
      kind: 'tape',
      identifier: position,
      label: position,
      magnitudeMm: spot.heightDiff,
      metadata: { layers: spot.layers, thickness: spot.layers * tapeThickness },
    }
  })
}

export function buildTapeStage(
  tapeCalculator: TapeCalculator,
  baseMesh: number[][],
  settings: CalibrationSettings,
  enabledFlag: boolean,
): [StageResult, number[][]] {
  const baseline = computeStageDeviation(baseMesh)

  if (!enabledFlag) {
    return [
      {
        key: 'after_tape',
        label: 'visual_rec.tape_header',
        description: 'visual_rec.stage_tape_details',
        enabled: false,
        deviation: baseline,
        baseline,
        mesh: copyMatrix(baseMesh),
        actions: [],
        warnings: ['visual_rec.stage_disabled'],
        helpKey: 'visual_rec.help.tape',
        metadata: {},
      },
      baseMesh,
    ]
  }

  const spots = tapeCalculator.optimizeTapeLayout(
    tapeCalculator.findLowSpots(baseMesh),
  )
  const meshAfter = spots.length > 0
    ? tapeCalculator.applySpots(baseMesh, spots)
    : copyMatrix(baseMesh)

  const deviationAfter = computeStageDeviation(meshAfter)
  const actions = buildTapeActions(spots, settings.hardware.tape_thickness)
  const warnings = actions.length === 0 ? ['visual_rec.tape_no_adjustments'] : []

  return [
    {
      key: 'after_tape',
      label: 'visual_rec.tape_header',
      description: 'visual_rec.stage_tape_details',
      enabled: true,
      deviation: deviationAfter,
      baseline,
      mesh: copyMatrix(meshAfter),
      actions,
      warnings,
      helpKey: 'visual_rec.help.tape',
      metadata: {},
    },
    meshAfter,
  ]
}

// ---------- temperature stage ----------

function applyTemperatureEffect(
  bed: Bed,
  mesh: number[][],
  envSettings: Record<string, number>,
  thermalModel?: Record<string, number>,
): [number[][], Record<string, number>] {
  const tm = thermalModel ?? {}
  const measurementTemp = tm['measurement_temp'] ?? envSettings['measurement_temp'] ?? 25.0
  const targetTemp = tm['target_temp'] ?? envSettings['target_temp'] ?? measurementTemp

  const info: Record<string, number> = {
    measurement_temp: measurementTemp,
    target_temp: targetTemp,
  }

  if (Math.abs(targetTemp - measurementTemp) < 1e-3 && Object.keys(tm).length === 0) {
    return [copyMatrix(mesh), info]
  }

  const chamberFactor = tm['chamber_factor'] ?? 0.0
  const peiThickness = tm['pei_thickness'] ?? 0.55
  const steelThickness = tm['steel_thickness'] ?? 1.50
  const alphaPei = tm['alpha_pei'] ?? envSettings['thermal_expansion_coeff'] ?? 0.0
  const alphaSteel = tm['alpha_steel'] ?? envSettings['thermal_expansion_coeff'] ?? 0.0
  const betaUniform = tm['beta_uniform'] ?? 0.2

  const totalTopDelta = targetTemp - measurementTemp
  const chamberTemp = measurementTemp + chamberFactor * totalTopDelta
  const deltaThrough = targetTemp - chamberTemp
  const deltaUniform = chamberTemp - measurementTemp

  Object.assign(info, {
    chamber_factor: chamberFactor,
    pei_thickness: peiThickness,
    steel_thickness: steelThickness,
    alpha_pei: alphaPei,
    alpha_steel: alphaSteel,
    beta_uniform: betaUniform,
    delta_through: deltaThrough,
    delta_uniform: deltaUniform,
    chamber_temp: chamberTemp,
  })

  const rows = mesh.length
  const cols = mesh[0].length
  const [xStep, yStep] = bed.getMmPerPoint()
  const centerX = bed.config.sizeX / 2
  const centerY = bed.config.sizeY / 2

  // Compute radius_sq for each point
  const radiusSq = zerosMatrix(rows, cols)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const X = i * xStep - centerX
      const Y = j * yStep - centerY
      radiusSq[i][j] = X * X + Y * Y
    }
  }

  const warp = zerosMatrix(rows, cols)
  let kappaBimetal = 0.0
  let kappaUniform = 0.0
  let kappaFallback = 0.0

  const totalThickness = Math.max(peiThickness + steelThickness, 1e-6)

  // Bimetal curvature
  if (
    Math.abs(deltaThrough) > 1e-6 &&
    peiThickness > 0 &&
    steelThickness > 0 &&
    Math.abs(alphaPei - alphaSteel) > 1e-12
  ) {
    const rho = peiThickness / steelThickness
    const n = 3.3e9 / 200e9
    const stiffness = 1 + 4 * rho + 6 * rho ** 2 + 4 * rho ** 3 + rho ** 4
    const coupling = 1 + (n * rho ** 2 * (1 + rho) ** 2) / Math.max(stiffness, 1e-6)
    const numerator = 6 * (alphaPei - alphaSteel) * deltaThrough
    const denom = steelThickness * (1 + rho) ** 2 * Math.max(stiffness, 1e-6)
    kappaBimetal = (numerator / denom) / coupling

    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++)
        warp[i][j] += 0.5 * kappaBimetal * radiusSq[i][j]
  }

  // Uniform curvature
  if (Math.abs(deltaUniform) > 1e-6 && Math.abs(alphaSteel) > 1e-12) {
    kappaUniform = betaUniform * alphaSteel * deltaUniform / totalThickness
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++)
        warp[i][j] += 0.5 * kappaUniform * radiusSq[i][j]
  }

  // Fallback if no warp computed
  const warpFlat = warp.flat()
  if (!warpFlat.some(v => v !== 0)) {
    const expansionCoeff = envSettings['thermal_expansion_coeff'] ?? 0.0
    const deltaTemp = targetTemp - measurementTemp
    if (Math.abs(deltaTemp) < 1e-3 || Math.abs(expansionCoeff) < 1e-9) {
      Object.assign(info, {
        kappa_bimetal: 0, kappa_uniform: 0, kappa_total: 0,
        warp_max: 0, warp_min: 0, warp_range: 0,
      })
      return [copyMatrix(mesh), info]
    }
    const maxRadiusSq = centerX ** 2 + centerY ** 2
    if (maxRadiusSq <= 0) {
      Object.assign(info, {
        kappa_bimetal: 0, kappa_uniform: 0, kappa_total: 0,
        warp_max: 0, warp_min: 0, warp_range: 0,
      })
      return [copyMatrix(mesh), info]
    }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++)
        warp[i][j] = expansionCoeff * deltaTemp * (radiusSq[i][j] / maxRadiusSq)
    kappaFallback = 2 * expansionCoeff * deltaTemp / maxRadiusSq
  }

  // Remove mean warp
  const warpMean = mean2D(warp)
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      warp[i][j] -= warpMean

  info['kappa_bimetal'] = kappaBimetal
  info['kappa_uniform'] = kappaUniform
  info['kappa_total'] = kappaBimetal + kappaUniform + kappaFallback
  info['warp_max'] = max2D(warp)
  info['warp_min'] = min2D(warp)
  info['warp_range'] = info['warp_max'] - info['warp_min']

  // Apply warp to mesh
  const result = copyMatrix(mesh)
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      result[i][j] += warp[i][j]

  return [result, info]
}

export function buildTemperatureStage(
  bed: Bed,
  baseMesh: number[][],
  envSettings: Record<string, number>,
  enabledFlag: boolean,
  thermalModel?: Record<string, number>,
): [StageResult, number[][]] {
  const baseline = computeStageDeviation(baseMesh)
  const [meshAfter, info] = applyTemperatureEffect(bed, baseMesh, envSettings, thermalModel)
  const deviationAfter = computeStageDeviation(meshAfter)

  const enabled = enabledFlag && Math.abs(deviationAfter - baseline) > 1e-6
  const warnings = !enabled ? ['visual_rec.temperature_no_adjustments'] : []

  return [
    {
      key: 'after_temperature',
      label: 'visual_rec.stage_temperature',
      description: 'visual_rec.stage_temperature_details',
      enabled,
      deviation: deviationAfter,
      baseline,
      mesh: copyMatrix(meshAfter),
      actions: [],
      warnings,
      helpKey: 'visual_rec.help.temperature',
      metadata: info,
    },
    meshAfter,
  ]
}

// ---------- orchestrator ----------

export function computeWorkflow(
  bed: Bed,
  analyzer: DeviationAnalyzer,
  screwSolver: ScrewSolver,
  tapeCalculator: TapeCalculator,
  settings: CalibrationSettings,
): WorkflowData {
  const workflowFlags = {
    enable_belt: true,
    enable_screws: true,
    enable_tape: true,
    ...settings.workflow,
  }
  const envSettings = settings.environment as unknown as Record<string, number>

  const stages: StageResult[] = []
  let meshState = copyMatrix(bed.meshData!)

  // Initial
  const initialStage: StageResult = {
    key: 'initial',
    label: 'visual_rec.stage_initial',
    description: 'visual_rec.stage_initial_details',
    enabled: true,
    deviation: computeStageDeviation(meshState),
    baseline: null,
    mesh: copyMatrix(meshState),
    actions: [],
    warnings: [],
    helpKey: 'visual_rec.help.initial',
    metadata: {},
  }
  stages.push(initialStage)

  // Belt
  const [beltStage, meshAfterBelt] = buildBeltStage(
    bed, screwSolver, settings, meshState, workflowFlags.enable_belt,
  )
  stages.push(beltStage)
  meshState = meshAfterBelt

  // Screws
  const [screwStage, meshAfterScrews] = buildScrewStage(
    analyzer, screwSolver, meshState, workflowFlags.enable_screws,
  )
  stages.push(screwStage)
  meshState = meshAfterScrews

  // Tape
  const [tapeStage, meshAfterTape] = buildTapeStage(
    tapeCalculator, meshState, settings, workflowFlags.enable_tape,
  )
  stages.push(tapeStage)
  meshState = meshAfterTape

  // Temperature
  const [tempStage, meshAfterTemp] = buildTemperatureStage(
    bed, meshState, envSettings, true, settings.thermal_model,
  )
  stages.push(tempStage)
  meshState = meshAfterTemp

  const enabledStages = stages.filter(s => s.enabled)
  const bestStage = enabledStages.length > 0
    ? enabledStages.reduce((best, s) => (s.deviation < best.deviation ? s : best))
    : stages[0]

  return {
    stages,
    bestStage,
    activeThermalModel: settings.thermal_model,
  }
}
