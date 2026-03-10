import type { TapeSpot } from './types'
import { Bed } from './bed'
import { copyMatrix, mean2D } from '../utils'

export class TapeCalculator {
  bed: Bed
  tapeThickness: number
  minHeightDiff: number

  constructor(
    bed: Bed,
    tapeThickness: number = 0.06,
    minHeightDiff: number = 0.1,
  ) {
    this.bed = bed
    this.tapeThickness = tapeThickness
    this.minHeightDiff = minHeightDiff
  }

  private _calculatePriority(heightDiff: number): number {
    if (heightDiff > 0.3) return 1
    if (heightDiff > 0.2) return 2
    return 3
  }

  private _isNearScrew(x: number, y: number): boolean {
    for (const [cx, cy] of Object.values(this.bed.corners)) {
      if (x === cx && y === cy) return true
    }
    return false
  }

  private _calculateAreaSize(x: number, y: number, heightDiff: number): number {
    const [xStep, yStep] = this.bed.getMmPerPoint()
    const baseArea = xStep * yStep
    return heightDiff > 0.3 ? baseArea * 1.5 : baseArea
  }

  findLowSpots(simulatedMesh: number[][]): TapeSpot[] {
    const meanHeight = mean2D(simulatedMesh)
    const spots: TapeSpot[] = []

    for (let x = 0; x < this.bed.config.meshPointsX; x++) {
      for (let y = 0; y < this.bed.config.meshPointsY; y++) {
        if (this._isNearScrew(x, y)) continue

        const height = simulatedMesh[x][y]
        const diff = meanHeight - height

        if (diff > this.minHeightDiff) {
          const layers = Math.max(1, Math.ceil(diff / this.tapeThickness))
          spots.push({
            x,
            y,
            layers,
            heightDiff: diff,
            priority: this._calculatePriority(diff),
            areaSize: this._calculateAreaSize(x, y, diff),
          })
        }
      }
    }

    return spots.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return b.heightDiff - a.heightDiff
    })
  }

  optimizeTapeLayout(spots: TapeSpot[]): TapeSpot[] {
    const optimized: TapeSpot[] = []
    const used = new Set<string>()

    for (const spot of spots) {
      const key = `${spot.x},${spot.y}`
      if (used.has(key)) continue

      const nearby = spots.filter(
        s =>
          Math.abs(s.x - spot.x) <= 1 &&
          Math.abs(s.y - spot.y) <= 1 &&
          !used.has(`${s.x},${s.y}`),
      )

      if (nearby.length > 0) {
        const avgDiff =
          nearby.reduce((sum, s) => sum + s.heightDiff, 0) / nearby.length
        const avgLayers = Math.max(1, Math.ceil(avgDiff / this.tapeThickness))
        const totalArea = nearby.reduce((sum, s) => sum + s.areaSize, 0)

        const avgX = nearby.reduce((sum, s) => sum + s.x, 0) / nearby.length
        const avgY = nearby.reduce((sum, s) => sum + s.y, 0) / nearby.length

        let center = spot
        if (nearby.length > 1) {
          center = nearby.reduce((best, s) => {
            const sDist = Math.abs(s.x - avgX) + Math.abs(s.y - avgY)
            const bDist = Math.abs(best.x - avgX) + Math.abs(best.y - avgY)
            return sDist < bDist ? s : best
          })
        }

        optimized.push({
          x: center.x,
          y: center.y,
          layers: avgLayers,
          heightDiff: avgDiff,
          priority: Math.min(...nearby.map(s => s.priority)),
          areaSize: totalArea,
        })

        for (const s of nearby) {
          used.add(`${s.x},${s.y}`)
        }
      } else {
        optimized.push(spot)
        used.add(key)
      }
    }

    return optimized
  }

  applySpots(baseMesh: number[][], spots: TapeSpot[]): number[][] {
    const simulated = copyMatrix(baseMesh)

    for (const spot of spots) {
      const heightIncrease = spot.layers * this.tapeThickness
      const xStart = Math.max(0, spot.x - 1)
      const xEnd = Math.min(this.bed.config.meshPointsX, spot.x + 2)
      const yStart = Math.max(0, spot.y - 1)
      const yEnd = Math.min(this.bed.config.meshPointsY, spot.y + 2)

      for (let i = xStart; i < xEnd; i++) {
        for (let j = yStart; j < yEnd; j++) {
          simulated[i][j] += heightIncrease
        }
      }
    }

    return simulated
  }

  estimateImprovement(spots: TapeSpot[]): number {
    if (!this.bed.meshData) throw new Error('Mesh data not available')
    const simulated = this.applySpots(this.bed.meshData, spots)

    const currentMean = mean2D(this.bed.meshData)
    const simMean = mean2D(simulated)

    const currentDev = Math.max(
      ...this.bed.meshData.flat().map(v => Math.abs(v - currentMean)),
    )
    const simDev = Math.max(
      ...simulated.flat().map(v => Math.abs(v - simMean)),
    )

    return currentDev - simDev
  }
}
