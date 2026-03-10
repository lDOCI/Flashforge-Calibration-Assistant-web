import type { ScrewConfig, ScrewAdjustment } from './types'
import { RotationDirection } from './types'
import { Bed } from './bed'
import { Screw, DEFAULT_SCREW_CONFIG } from './screw'
import { linspace, copyMatrix, zerosMatrix } from '../utils'

export class ScrewSolver {
  bed: Bed
  screwConfig: ScrewConfig
  screws: Record<string, Screw>
  cornerWeights: Record<string, number[][]>

  constructor(bed: Bed, screwConfig?: ScrewConfig) {
    this.bed = bed
    this.screwConfig = screwConfig || DEFAULT_SCREW_CONFIG
    this.screws = {}
    this.cornerWeights = {}
    this._buildScrews()
    this._computeCornerWeights()
  }

  setScrewConfig(config: ScrewConfig): void {
    this.screwConfig = config
    this._buildScrews()
    this._computeCornerWeights()
  }

  private _buildScrews(): void {
    this.screws = {}
    for (const corner of Object.keys(this.bed.corners)) {
      this.screws[corner] = new Screw(corner, this.screwConfig)
    }
  }

  private _computeCornerWeights(): void {
    const rows = this.bed.config.meshPointsX
    const cols = this.bed.config.meshPointsY

    if (rows < 2 || cols < 2) {
      this.cornerWeights = {}
      for (const corner of Object.keys(this.bed.corners)) {
        this.cornerWeights[corner] = Array.from({ length: rows }, () => Array(cols).fill(1))
      }
      return
    }

    const rowFactors = linspace(0, 1, rows)
    const colFactors = linspace(0, 1, cols)

    this.cornerWeights = {
      front_left: zerosMatrix(rows, cols),
      front_right: zerosMatrix(rows, cols),
      back_left: zerosMatrix(rows, cols),
      back_right: zerosMatrix(rows, cols),
    }

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        this.cornerWeights.front_left[i][j] = (1 - rowFactors[i]) * (1 - colFactors[j])
        this.cornerWeights.front_right[i][j] = (1 - rowFactors[i]) * colFactors[j]
        this.cornerWeights.back_left[i][j] = rowFactors[i] * (1 - colFactors[j])
        this.cornerWeights.back_right[i][j] = rowFactors[i] * colFactors[j]
      }
    }

    // Normalize weights to sum to 1 at each point
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const total =
          this.cornerWeights.front_left[i][j] +
          this.cornerWeights.front_right[i][j] +
          this.cornerWeights.back_left[i][j] +
          this.cornerWeights.back_right[i][j]
        if (total !== 0) {
          const correction = 1.0 / total
          this.cornerWeights.front_left[i][j] *= correction
          this.cornerWeights.front_right[i][j] *= correction
          this.cornerWeights.back_left[i][j] *= correction
          this.cornerWeights.back_right[i][j] *= correction
        }
      }
    }
  }

  private _calculatePriority(deviation: number): number {
    if (deviation > 0.4) return 1
    if (deviation > 0.3) return 2
    if (deviation > 0.2) return 3
    return 4
  }

  calculateAdjustments(idealPlane: number[][]): ScrewAdjustment[] {
    const adjustments: ScrewAdjustment[] = []

    for (const [corner, [x, y]] of Object.entries(this.bed.corners)) {
      const currentHeight = this.bed.getCornerHeight(corner)
      const targetHeight = idealPlane[x][y]

      const screw = this.screws[corner]
      const [minutes, direction] = screw.calculateAdjustment(currentHeight, targetHeight)

      if (minutes > 0) {
        const deviation = Math.abs(currentHeight - targetHeight)
        adjustments.push({
          corner,
          minutes,
          degrees: screw.minutesToDegrees(minutes),
          direction,
          currentHeight,
          targetHeight,
          priority: this._calculatePriority(deviation),
          turns: minutes / 60.0,
        })
      }
    }

    return adjustments.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return Math.abs(b.currentHeight - b.targetHeight) - Math.abs(a.currentHeight - a.targetHeight)
    })
  }

  simulateAdjustment(
    adjustment: ScrewAdjustment,
    baseMesh?: number[][],
  ): number[][] {
    const source = baseMesh ?? this.bed.meshData
    if (!source) throw new Error('Mesh data not available')

    const simulated = copyMatrix(source)
    const screw = this.screws[adjustment.corner]
    const heightChange = screw.heightChangeFromMinutes(adjustment.minutes, adjustment.direction)
    const weightMap = this.cornerWeights[adjustment.corner]
    if (!weightMap) throw new Error(`Weight map not found for ${adjustment.corner}`)

    const rows = simulated.length
    const cols = simulated[0].length
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        simulated[i][j] += heightChange * weightMap[i][j]
      }
    }
    return simulated
  }

  simulateSequence(
    adjustments: ScrewAdjustment[],
    baseMesh?: number[][],
  ): number[][] {
    const source = baseMesh ?? this.bed.meshData
    if (!source) throw new Error('Mesh data not available')

    let mesh = copyMatrix(source)
    for (const adj of adjustments) {
      mesh = this.simulateAdjustment(adj, mesh)
    }
    return mesh
  }

  estimateTotalImprovement(adjustments: ScrewAdjustment[]): number {
    if (!this.bed.meshData) throw new Error('Mesh data not available')
    const currentMesh = this.bed.meshData
    const simulatedMesh = this.simulateSequence(adjustments, currentMesh)

    const currentMean =
      currentMesh.flat().reduce((a, b) => a + b, 0) / currentMesh.flat().length
    const simMean =
      simulatedMesh.flat().reduce((a, b) => a + b, 0) / simulatedMesh.flat().length

    const currentDev = Math.max(...currentMesh.flat().map(v => Math.abs(v - currentMean)))
    const simDev = Math.max(...simulatedMesh.flat().map(v => Math.abs(v - simMean)))

    return currentDev - simDev
  }
}
