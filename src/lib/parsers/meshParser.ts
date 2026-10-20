import type { MeshData } from '../calibration/types'

const NUM = String.raw`-?\d+(?:\.\d+)?`
const POINT_PATTERN = new RegExp(String.raw`^#\*#\s+(${NUM}(?:\s*,\s*${NUM})*)\s*$`)
const PARAM_PATTERN = /^#\*#\s+(\w+)\s*=\s*(.*)$/
const SECTION_PATTERN = /^#\*#\s+\[([^\]]+)\]/
const BED_MESH_PATTERN = /^bed_mesh\s+(.+)$/

export interface ParsedMesh {
  name: string
  meshData: MeshData
}

/** Parses the SAVE_CONFIG `[bed_mesh NAME]` blocks Klipper appends to printer.cfg. */
export class KlipperMeshParser {
  parseAllMeshes(content: string): ParsedMesh[] {
    const lines = content.split(/\r?\n/).map(l => l.trim())
    const sections: { name: string; start: number; end: number }[] = []

    // Each [bed_mesh NAME] block runs until the next #*# [section] header.
    let current: { name: string; start: number } | null = null
    for (let i = 0; i < lines.length; i++) {
      const section = SECTION_PATTERN.exec(lines[i])
      if (!section) continue
      if (current) sections.push({ ...current, end: i })
      const mesh = BED_MESH_PATTERN.exec(section[1].trim())
      current = mesh ? { name: mesh[1].trim(), start: i + 1 } : null
    }
    if (current) sections.push({ ...current, end: lines.length })

    // No section headers at all: maybe a bare block was pasted.
    if (sections.length === 0) sections.push({ name: 'default', start: 0, end: lines.length })

    const results: ParsedMesh[] = []
    for (const s of sections) {
      const mesh = this.parseMeshBlock(lines.slice(s.start, s.end))
      if (mesh) results.push({ name: s.name, meshData: mesh })
    }
    return results
  }

  private parseMeshBlock(lines: string[]): MeshData | null {
    const rows: number[][] = []
    const params: Record<string, string> = {}

    for (const line of lines) {
      const point = POINT_PATTERN.exec(line)
      if (point) {
        rows.push(point[1].split(',').map(p => parseFloat(p)))
        continue
      }
      const param = PARAM_PATTERN.exec(line)
      if (param) params[param[1]] = param[2].trim()
    }

    const required = ['x_count', 'y_count', 'min_x', 'max_x', 'min_y', 'max_y']
    if (rows.length === 0 || !required.every(p => p in params)) return null

    return {
      matrix: rows,
      xCount: parseInt(params.x_count, 10),
      yCount: parseInt(params.y_count, 10),
      minX: parseFloat(params.min_x),
      maxX: parseFloat(params.max_x),
      minY: parseFloat(params.min_y),
      maxY: parseFloat(params.max_y),
    }
  }

  parseConfigFile(content: string): MeshData | null {
    return this.parseAllMeshes(content)[0]?.meshData ?? null
  }
}

/** Shape and value sanity checks; also used for meshes that arrive via share links. */
export function validateMeshData(m: MeshData): boolean {
  if (!Number.isInteger(m.xCount) || !Number.isInteger(m.yCount)) return false
  if (m.xCount < 2 || m.yCount < 2) return false
  if (![m.minX, m.maxX, m.minY, m.maxY].every(Number.isFinite)) return false
  if (m.maxX <= m.minX || m.maxY <= m.minY) return false
  if (!Array.isArray(m.matrix) || m.matrix.length !== m.yCount) return false
  return m.matrix.every(
    row =>
      Array.isArray(row) &&
      row.length === m.xCount &&
      row.every(v => Number.isFinite(v) && Math.abs(v) <= 10),
  )
}

/**
 * Drop meshes that repeat an earlier one in the same file (same grid, every
 * point within `tolerance` mm). Configs often carry a copy such as
 * MESH_DATA / MESH_DATA1 that differs by a rounding digit.
 */
export function dropDuplicateMeshes(meshes: ParsedMesh[], tolerance = 0.005): ParsedMesh[] {
  const same = (a: MeshData, b: MeshData) =>
    a.xCount === b.xCount &&
    a.yCount === b.yCount &&
    a.minX === b.minX && a.maxX === b.maxX && a.minY === b.minY && a.maxY === b.maxY &&
    a.matrix.every((row, i) => row.every((v, j) => Math.abs(v - b.matrix[i][j]) <= tolerance))
  return meshes.filter((m, i) => !meshes.slice(0, i).some(prev => same(prev.meshData, m.meshData)))
}
