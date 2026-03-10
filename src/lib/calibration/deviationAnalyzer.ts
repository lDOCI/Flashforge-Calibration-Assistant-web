import type { ScrewConfig, DeviationStats, LevelingStage } from './types'
import { RotationDirection } from './types'
import { Bed } from './bed'
import { Screw, DEFAULT_SCREW_CONFIG } from './screw'
import { copyMatrix, zerosMatrix } from '../utils'

export class DeviationAnalyzer {
  bed: Bed
  cornerAveragingSize: number
  screwThreshold: number
  tapeThreshold: number
  screwConfig: ScrewConfig
  private screws: Record<string, Screw>

  constructor(
    bed: Bed,
    cornerAveragingSize: number = 1,
    screwThreshold: number = 0.19,
    tapeThreshold: number = 0.01,
    screwConfig?: ScrewConfig,
  ) {
    this.bed = bed
    this.cornerAveragingSize = Math.max(0, Math.floor(cornerAveragingSize))
    this.screwThreshold = screwThreshold
    this.tapeThreshold = tapeThreshold
    this.screwConfig = screwConfig || DEFAULT_SCREW_CONFIG
    this.screws = {}
    this._buildScrews()
  }

  private _buildScrews(): void {
    this.screws = {}
    for (const corner of Object.keys(this.bed.corners)) {
      this.screws[corner] = new Screw(corner, this.screwConfig)
    }
  }

  setScrewConfig(config: ScrewConfig): void {
    this.screwConfig = config
    this._buildScrews()
  }

  setCornerAveragingSize(areaSize: number): void {
    this.cornerAveragingSize = Math.max(0, Math.floor(areaSize))
  }

  getStats(): DeviationStats {
    const [meanHeight] = this.bed.getMeshStats()
    const cornerDeviations: Record<string, number> = {}

    for (const corner of Object.keys(this.bed.corners)) {
      const height = this.bed.getCornerHeight(corner, this.cornerAveragingSize)
      cornerDeviations[corner] = Math.abs(height - meanHeight)
    }

    const maxDeviation = Math.max(...Object.values(cornerDeviations))
    const hasCritical = maxDeviation > this.screwThreshold

    return {
      meanHeight,
      maxDeviation,
      cornerDeviations,
      hasCriticalDeviation: hasCritical,
    }
  }

  analyzeLevelingStage(): LevelingStage {
    const stats = this.getStats()

    const heights = Object.keys(this.bed.corners).map(corner =>
      this.bed.getCornerHeight(corner, this.cornerAveragingSize),
    )
    const maxCornerDiff = Math.max(...heights) - Math.min(...heights)

    const problematic = Object.entries(stats.cornerDeviations)
      .filter(([, dev]) => dev > this.tapeThreshold)
      .map(([corner]) => corner)

    const canUseScrews = maxCornerDiff <= this.screwConfig.maxAdjust
    const needsScrewAdjustment = stats.maxDeviation > this.screwThreshold
    const needsTape = stats.maxDeviation > this.tapeThreshold

    return {
      needsScrewAdjustment,
      canUseScrews,
      needsTape,
      maxCornerDiff,
      problematicCorners: problematic,
    }
  }

  getIdealPlane(): number[][] {
    return this.bed.generateIdealPlane()
  }

  estimateBedAfterScrewAdjustment(): number[][] {
    if (!this.bed.meshData) throw new Error('Mesh data not set')

    const idealPlane = this.getIdealPlane()
    const simulated = copyMatrix(this.bed.meshData)
    const rows = this.bed.config.meshPointsX
    const cols = this.bed.config.meshPointsY

    const actions: Record<string, [number, RotationDirection]> = {}
    for (const [corner, [x, y]] of Object.entries(this.bed.corners)) {
      const currentHeight = this.bed.getCornerHeight(corner)
      const targetHeight = idealPlane[x][y]
      const screw = this.screws[corner]
      const [minutes, direction] = screw.calculateAdjustment(currentHeight, targetHeight)
      actions[corner] = [minutes, direction]
    }

    for (const [corner, [minutes, direction]] of Object.entries(actions)) {
      const [cx, cy] = this.bed.corners[corner]
      const screw = this.screws[corner]
      const heightChange = screw.heightChangeFromMinutes(minutes, direction)

      const influence = zerosMatrix(rows, cols)
      const maxDistance = Math.hypot(rows - 1, cols - 1)

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const distance = Math.hypot(i - cx, j - cy)
          influence[i][j] = Math.max(0, 1 - distance / maxDistance)
        }
      }

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          simulated[i][j] += heightChange * influence[i][j]
        }
      }
    }

    return simulated
  }

  getCornerActions(): Record<string, [number, RotationDirection]> {
    const idealPlane = this.getIdealPlane()
    const actions: Record<string, [number, RotationDirection]> = {}

    for (const [corner, [x, y]] of Object.entries(this.bed.corners)) {
      const currentHeight = this.bed.getCornerHeight(corner, this.cornerAveragingSize)
      const targetHeight = idealPlane[x][y]
      const screw = this.screws[corner]
      const [minutes, direction] = screw.calculateAdjustment(currentHeight, targetHeight)
      actions[corner] = [minutes, direction]
    }

    return actions
  }
}
