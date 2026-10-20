/**
 * Mesh as stored by Klipper: `matrix[row][col]`, row = Y index (row 0 = min_y,
 * the front of the bed), col = X index (col 0 = min_x, the left side).
 * So `matrix.length === yCount` and `matrix[0].length === xCount`.
 */
export interface MeshData {
  matrix: number[][]
  xCount: number
  yCount: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** A point in printer coordinates, mm. */
export type Point = [number, number]

/** Z lead screws (belt-synced) and spring-loaded bed screws. */
export type ShaftId = 'front_left' | 'front_right' | 'back'
export type CornerId = 'front_left' | 'front_right' | 'back_left' | 'back_right'

/** Single actionable step for a calibration stage. */
export interface StageAction {
  kind: 'belt' | 'screw' | 'tape'
  identifier: string
  label: string
  direction?: 'up' | 'down' | 'clockwise' | 'counterclockwise'
  magnitudeMm?: number
  teeth?: number
  minutes?: number
  degrees?: number
  metadata: Record<string, unknown>
}

export type StageKey = 'initial' | 'after_belts' | 'after_screws' | 'after_tape'

/** Result of one calibration stage. */
export interface StageResult {
  key: StageKey
  label: string
  description: string
  enabled: boolean
  /** Peak-to-peak range (max - min) of the mesh after this stage, mm. */
  deviation: number
  /** Range before this stage, mm. Null for the initial stage. */
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
  /** Range left after removing the best-fit plane: the floor for belts + screws. */
  flatnessFloor: number
}

/** Settings shape expected by the workflow engine. */
export interface CalibrationSettings {
  hardware: {
    /** Bed screw thread pitch, mm per full turn. */
    screw_pitch: number
    /** Skip a screw if its adjustment is below this, mm. */
    min_adjustment: number
    /** Never ask for more than this per screw, mm. */
    max_adjustment: number
    tape_thickness: number
    max_tape_layers: number
    /** Size of one tape piece, mm; dense meshes are grouped into patches this big. */
    tape_patch_mm: number
    /** Bed height change per belt tooth: leadscrew lead / pulley teeth (8 mm / 20T = 0.4). */
    belt_tooth_mm: number
    screw_mode: 'hold_nut' | 'hold_screw'
  }
  geometry: {
    bed_size_x: number
    bed_size_y: number
    /** Z lead screw positions relative to bed center, mm (+Y = back). */
    shaft_front_left: Point
    shaft_front_right: Point
    shaft_back: Point
    /** Bed screws sit at (±screw_offset_x, ±screw_offset_y) from bed center, mm. */
    screw_offset_x: number
    screw_offset_y: number
  }
  thresholds: {
    /** Only suggest belt moves that cut the range by at least this much, mm. */
    belt_threshold: number
    /** Only suggest screw turns that cut the range by at least this much, mm. */
    screw_threshold: number
    /** Only tape spots at least this deep, mm. */
    tape_threshold: number
  }
  visualization: {
    interpolation_factor: number
    show_minutes: boolean
    show_degrees: boolean
  }
  workflow: {
    enable_belt: boolean
    enable_screws: boolean
    enable_tape: boolean
  }
}
