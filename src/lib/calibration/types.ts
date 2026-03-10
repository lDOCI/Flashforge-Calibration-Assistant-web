/** Configuration of the printer bed. */
export interface BedConfig {
  sizeX: number
  sizeY: number
  meshPointsX: number
  meshPointsY: number
}

/** Parsed mesh data from printer.cfg. */
export interface MeshData {
  matrix: number[][]
  xCount: number
  yCount: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** Screw hardware configuration. */
export interface ScrewConfig {
  type: string
  pitch: number
  minAdjust: number
  maxAdjust: number
}

export enum RotationDirection {
  CLOCKWISE = 'clockwise',
  COUNTERCLOCKWISE = 'counterclockwise',
}

/** Result of a screw adjustment calculation. */
export interface ScrewAdjustment {
  corner: string
  minutes: number
  degrees: number
  direction: RotationDirection
  currentHeight: number
  targetHeight: number
  priority: number
  turns: number
}

/** A spot where tape should be applied. */
export interface TapeSpot {
  x: number
  y: number
  layers: number
  heightDiff: number
  priority: number
  areaSize: number
}

/** Single actionable step for a calibration stage. */
export interface StageAction {
  kind: string
  identifier: string
  label: string
  direction?: string
  magnitudeMm?: number
  teeth?: number
  minutes?: number
  degrees?: number
  metadata: Record<string, unknown>
}

/** Result of one calibration stage. */
export interface StageResult {
  key: string
  label: string
  description: string
  enabled: boolean
  deviation: number
  baseline: number | null
  mesh: number[][]
  actions: StageAction[]
  warnings: string[]
  helpKey?: string
  metadata: Record<string, unknown>
}

/** Aggregated workflow data. */
export interface WorkflowData {
  stages: StageResult[]
  bestStage: StageResult
  activeThermalModel?: Record<string, number>
}

/** Deviation statistics. */
export interface DeviationStats {
  meanHeight: number
  maxDeviation: number
  cornerDeviations: Record<string, number>
  hasCriticalDeviation: boolean
}

/** Leveling stage determination. */
export interface LevelingStage {
  needsScrewAdjustment: boolean
  canUseScrews: boolean
  needsTape: boolean
  maxCornerDiff: number
  problematicCorners: string[]
}

/** Settings dictionary shape expected by the workflow engine. */
export interface CalibrationSettings {
  hardware: {
    screw_pitch: number
    min_adjustment: number
    max_adjustment: number
    tape_thickness: number
    belt_tooth_mm: number
    corner_averaging: number
    screw_mode: string
  }
  thresholds: {
    belt_threshold: number
    screw_threshold: number
    tape_threshold: number
  }
  visualization: {
    interpolation_factor: number
    show_minutes: boolean
    show_degrees: boolean
  }
  environment: {
    measurement_temp: number
    target_temp: number
    thermal_expansion_coeff: number
  }
  workflow: {
    enable_belt: boolean
    enable_screws: boolean
    enable_tape: boolean
  }
  thermal_model?: Record<string, number>
}
