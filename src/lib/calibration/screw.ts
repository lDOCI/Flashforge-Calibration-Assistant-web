import { RotationDirection } from './types'
import type { ScrewConfig } from './types'

export const DEFAULT_SCREW_CONFIG: ScrewConfig = {
  type: 'M4',
  pitch: 0.7,
  minAdjust: 0.1,
  maxAdjust: 2.0,
}

export class Screw {
  position: string
  config: ScrewConfig
  mmPerMinute: number
  mmPerDegree: number

  constructor(position: string, config: ScrewConfig = DEFAULT_SCREW_CONFIG) {
    this.position = position
    this.config = config
    this.mmPerMinute = config.pitch / 60
    this.mmPerDegree = config.pitch / 360
  }

  calculateAdjustment(
    currentHeight: number,
    targetHeight: number,
  ): [number, RotationDirection] {
    const diff = currentHeight - targetHeight

    if (Math.abs(diff) < this.config.minAdjust) {
      return [0, RotationDirection.CLOCKWISE]
    }

    const direction =
      diff > 0 ? RotationDirection.CLOCKWISE : RotationDirection.COUNTERCLOCKWISE

    const minutes = Math.min(
      Math.abs(diff) / this.mmPerMinute,
      this.config.maxAdjust / this.mmPerMinute,
    )

    return [minutes, direction]
  }

  minutesToDegrees(minutes: number): number {
    return minutes * 6
  }

  heightChangeFromMinutes(minutes: number, direction: RotationDirection): number {
    const change = minutes * this.mmPerMinute
    return direction === RotationDirection.CLOCKWISE ? -change : change
  }

  heightChangeFromDegrees(degrees: number, direction: RotationDirection): number {
    const change = degrees * this.mmPerDegree
    return direction === RotationDirection.CLOCKWISE ? -change : change
  }
}
