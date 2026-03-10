import type { MeshData } from '../calibration/types'

const POINT_PATTERN = /#\*#\s+((?:-?\d+\.\d+,\s*)*-?\d+\.\d+)/
const PARAM_PATTERN = /#\*#\s+(\w+)\s+=\s+(.+)/
const SECTION_PATTERN = /#\*#\s+\[bed_mesh\s+(.*?)\]/

export interface ParsedMesh {
  name: string
  meshData: MeshData
}

export class KlipperMeshParser {
  /**
   * Parse all bed_mesh sections from a printer.cfg file.
   * Returns an array of named meshes.
   */
  parseAllMeshes(content: string): ParsedMesh[] {
    const lines = content.split('\n')
    const sections: { name: string; startIdx: number }[] = []

    // Find all [bed_mesh NAME] section headers
    for (let i = 0; i < lines.length; i++) {
      const match = SECTION_PATTERN.exec(lines[i])
      if (match) {
        sections.push({ name: match[1].trim(), startIdx: i })
      }
    }

    if (sections.length === 0) {
      // Fallback: try parsing the whole file as a single mesh
      const mesh = this.parseMeshBlock(lines, 0, lines.length)
      if (mesh) return [{ name: 'default', meshData: mesh }]
      return []
    }

    const results: ParsedMesh[] = []
    for (let s = 0; s < sections.length; s++) {
      const start = sections[s].startIdx
      // End at next section or end of file — but we need to find
      // the next #*# section header (any type, not just bed_mesh)
      const end = s + 1 < sections.length
        ? sections[s + 1].startIdx
        : this.findNextNonBedSection(lines, start + 1, lines.length)

      const mesh = this.parseMeshBlock(lines, start, end)
      if (mesh) {
        results.push({ name: sections[s].name, meshData: mesh })
      }
    }

    return results
  }

  /** Find where the next #*# [something_else] section starts, or return endIdx */
  private findNextNonBedSection(lines: string[], startIdx: number, endIdx: number): number {
    for (let i = startIdx; i < endIdx; i++) {
      const line = lines[i]
      if (/#\*#\s+\[(?!bed_mesh)/.test(line)) {
        return i
      }
    }
    return endIdx
  }

  /** Parse a single mesh block from a range of lines */
  private parseMeshBlock(lines: string[], startIdx: number, endIdx: number): MeshData | null {
    const pointsData: number[][] = []
    const params: Record<string, string> = {}

    for (let i = startIdx; i < endIdx; i++) {
      const line = lines[i]

      const pointMatch = POINT_PATTERN.exec(line)
      if (pointMatch) {
        const points = pointMatch[1].split(',').map(p => parseFloat(p.trim()))
        pointsData.push(points)
        continue
      }

      const paramMatch = PARAM_PATTERN.exec(line)
      if (paramMatch && !SECTION_PATTERN.test(line)) {
        params[paramMatch[1]] = paramMatch[2].trim()
      }
    }

    const required = ['x_count', 'y_count', 'min_x', 'max_x', 'min_y', 'max_y']
    if (!required.every(p => p in params)) return null
    if (pointsData.length === 0) return null

    const xCount = parseInt(params['x_count'])
    const yCount = parseInt(params['y_count'])

    return {
      matrix: pointsData,
      xCount,
      yCount,
      minX: parseFloat(params['min_x']),
      maxX: parseFloat(params['max_x']),
      minY: parseFloat(params['min_y']),
      maxY: parseFloat(params['max_y']),
    }
  }

  /** Legacy single-mesh parse — returns the first mesh found */
  parseConfigFile(content: string): MeshData | null {
    const meshes = this.parseAllMeshes(content)
    return meshes.length > 0 ? meshes[0].meshData : null
  }

  validateMeshData(meshData: MeshData): boolean {
    if (meshData.matrix.length !== meshData.yCount) return false
    if (meshData.matrix[0]?.length !== meshData.xCount) return false

    for (const row of meshData.matrix) {
      for (const val of row) {
        if (Math.abs(val) > 10) return false
        if (!isFinite(val)) return false
      }
    }

    return true
  }
}
