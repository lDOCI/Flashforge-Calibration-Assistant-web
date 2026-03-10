import type { BedConfig } from './types'
import { mean2D, max2D, min2D, copyMatrix, fullMatrix, zerosMatrix } from '../utils'

export const DEFAULT_BED_CONFIG: BedConfig = {
  sizeX: 220,
  sizeY: 220,
  meshPointsX: 5,
  meshPointsY: 5,
}

export class Bed {
  config: BedConfig
  meshData: number[][] | null = null
  corners: Record<string, [number, number]>

  constructor(config: BedConfig = DEFAULT_BED_CONFIG) {
    this.config = config
    this.corners = {
      front_left: [0, 0],
      front_right: [0, config.meshPointsY - 1],
      back_left: [config.meshPointsX - 1, 0],
      back_right: [config.meshPointsX - 1, config.meshPointsY - 1],
    }
  }

  setMeshData(data: number[][]): void {
    if (
      data.length !== this.config.meshPointsX ||
      data[0].length !== this.config.meshPointsY
    ) {
      throw new Error(
        `Invalid mesh size: [${data.length}, ${data[0].length}], ` +
        `expected: [${this.config.meshPointsX}, ${this.config.meshPointsY}]`
      )
    }
    this.meshData = copyMatrix(data)
  }

  getCornerHeight(corner: string, areaSize: number = 1): number {
    if (!this.meshData) throw new Error('Mesh data not set')
    const pos = this.corners[corner]
    if (!pos) throw new Error(`Unknown corner: ${corner}`)

    const [x, y] = pos
    const xStart = Math.max(0, x - areaSize)
    const xEnd = Math.min(this.config.meshPointsX, x + areaSize + 1)
    const yStart = Math.max(0, y - areaSize)
    const yEnd = Math.min(this.config.meshPointsY, y + areaSize + 1)

    let sum = 0
    let count = 0
    for (let i = xStart; i < xEnd; i++) {
      for (let j = yStart; j < yEnd; j++) {
        sum += this.meshData[i][j]
        count++
      }
    }
    return count === 0 ? 0 : sum / count
  }

  getMeshStats(): [number, number, number] {
    if (!this.meshData) throw new Error('Mesh data not set')
    return [mean2D(this.meshData), min2D(this.meshData), max2D(this.meshData)]
  }

  getPointHeight(x: number, y: number): number {
    if (!this.meshData) throw new Error('Mesh data not set')
    if (x < 0 || x >= this.config.meshPointsX || y < 0 || y >= this.config.meshPointsY) {
      throw new Error(`Coordinates (${x}, ${y}) out of range`)
    }
    return this.meshData[x][y]
  }

  getMmPerPoint(): [number, number] {
    return [
      this.config.sizeX / (this.config.meshPointsX - 1),
      this.config.sizeY / (this.config.meshPointsY - 1),
    ]
  }

  generateIdealPlane(): number[][] {
    if (!this.meshData) throw new Error('Mesh data not set')
    const meanH = mean2D(this.meshData)
    return fullMatrix(this.config.meshPointsX, this.config.meshPointsY, meanH)
  }

  calculateDeviationMap(): number[][] {
    if (!this.meshData) throw new Error('Mesh data not set')
    const ideal = this.generateIdealPlane()
    const rows = this.config.meshPointsX
    const cols = this.config.meshPointsY
    const result = zerosMatrix(rows, cols)
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[i][j] = this.meshData[i][j] - ideal[i][j]
      }
    }
    return result
  }

  simulateAdjustment(cornerAdjustments: Record<string, number>): number[][] {
    if (!this.meshData) throw new Error('Mesh data not set')
    const adjusted = copyMatrix(this.meshData)
    const rows = this.config.meshPointsX
    const cols = this.config.meshPointsY
    const maxDistance = Math.hypot(rows - 1, cols - 1)

    for (const [corner, adjustment] of Object.entries(cornerAdjustments)) {
      const pos = this.corners[corner]
      if (!pos) continue
      const [cx, cy] = pos

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const distance = Math.hypot(i - cx, j - cy)
          const influence = Math.max(0, 1 - distance / maxDistance)
          adjusted[i][j] += adjustment * influence
        }
      }
    }
    return adjusted
  }
}
