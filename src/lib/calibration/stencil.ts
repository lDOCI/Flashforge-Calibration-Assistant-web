/**
 * Universal tape stencil: a printed 220×220 mm lattice with 5×5 open windows.
 * Print it once, lay it on the bed's vinyl base where the PEI sheet goes,
 * and stick tape through the windows the app names (A1 = front-left).
 *
 * The app plans tape on exactly these cells, so this file is the single
 * source of the layout for both the calibration engine and the STL
 * generator (scripts/make-stencil.mjs). No imports: Node runs it directly.
 */

export const STENCIL = {
  /** Windows per side. */
  cells: 5,
  /** Overall size, mm; matches the AD5M print area so the slicer centres it on the bed. */
  outer: 220,
  /** Border with the row/column labels, mm. */
  frame: 5,
  /** Ribs between windows, mm. */
  rib: 3,
  /** Plate thickness, mm (3 layers at 0.2). */
  base: 0.6,
  /** Raised label height on top of the plate, mm. */
  text: 0.4,
  /** Label pixel size, mm (3×5 pixel font). */
  pixel: 0.8,
} as const

/** Size of one cell (window + its share of the ribs), mm. */
export const CELL_MM = (STENCIL.outer - 2 * STENCIL.frame) / STENCIL.cells

/** Inner edge of the frame, mm from the bed centre. */
export const INNER_HALF = STENCIL.outer / 2 - STENCIL.frame

/**
 * Stencil cell index (0..cells-1) of a coordinate given relative to the bed
 * centre. Points on the frame or outside count as the nearest edge cell.
 */
export function cellIndex(offsetMm: number): number {
  const i = Math.floor((offsetMm + INNER_HALF) / CELL_MM)
  return Math.min(STENCIL.cells - 1, Math.max(0, i))
}

/** An axis-aligned box, mm, in bed-centred coordinates (+Y = back). */
export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
  z0: number
  z1: number
}

// 3×5 pixel font, rows top to bottom.
const FONT: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
}

/** Raised boxes for one character centred at (cx, cy); runs of pixels are merged. */
function glyph(ch: string, cx: number, cy: number): Box[] {
  const p = STENCIL.pixel
  const rows = FONT[ch]
  const x0 = cx - (3 * p) / 2
  const yTop = cy + (5 * p) / 2
  const z0 = STENCIL.base
  const z1 = STENCIL.base + STENCIL.text
  const boxes: Box[] = []
  rows.forEach((row, r) => {
    let c = 0
    while (c < 3) {
      if (row[c] !== '#') { c++; continue }
      let end = c
      while (end + 1 < 3 && row[end + 1] === '#') end++
      boxes.push({ x0: x0 + c * p, x1: x0 + (end + 1) * p, y0: yTop - (r + 1) * p, y1: yTop - r * p, z0, z1 })
      c = end + 1
    }
  })
  return boxes
}

/**
 * The whole stencil as non-overlapping boxes: frame, ribs and raised labels
 * (column letters along the front edge, row numbers along the left edge).
 */
export function stencilBoxes(): Box[] {
  const { outer, rib, base, cells } = STENCIL
  const H = outer / 2
  const I = INNER_HALF
  const r = rib / 2
  const z0 = 0
  const z1 = base
  const boxes: Box[] = [
    { x0: -H, x1: H, y0: -H, y1: -I, z0, z1 }, // front frame
    { x0: -H, x1: H, y0: I, y1: H, z0, z1 }, // back frame
    { x0: -H, x1: -I, y0: -I, y1: I, z0, z1 }, // left frame
    { x0: I, x1: H, y0: -I, y1: I, z0, z1 }, // right frame
  ]

  const lines = Array.from({ length: cells - 1 }, (_, k) => -I + (k + 1) * CELL_MM)
  // Horizontal ribs run the full inner width…
  for (const y of lines) boxes.push({ x0: -I, x1: I, y0: y - r, y1: y + r, z0, z1 })
  // …vertical ribs fill the gaps between them, so nothing overlaps.
  const ySpans: [number, number][] = []
  let from = -I
  for (const y of lines) {
    ySpans.push([from, y - r])
    from = y + r
  }
  ySpans.push([from, I])
  for (const x of lines) {
    for (const [y0, y1] of ySpans) boxes.push({ x0: x - r, x1: x + r, y0, y1, z0, z1 })
  }

  const centre = (i: number) => -I + (i + 0.5) * CELL_MM
  const frameMid = -(H + I) / 2
  for (let i = 0; i < cells; i++) {
    boxes.push(...glyph(String.fromCharCode(65 + i), centre(i), frameMid)) // A–E, front edge
    boxes.push(...glyph(String(i + 1), frameMid, centre(i))) // 1–5, left edge
  }
  return boxes
}

/** Binary STL of the given boxes (12 triangles each). */
export function boxesToStl(boxes: Box[], header = 'Flashforge Calibration Assistant tape stencil'): Uint8Array {
  const buf = new ArrayBuffer(84 + boxes.length * 12 * 50)
  const view = new DataView(buf)
  const head = new TextEncoder().encode(header.slice(0, 80))
  new Uint8Array(buf).set(head, 0)
  view.setUint32(80, boxes.length * 12, true)

  let off = 84
  const tri = (n: number[], a: number[], b: number[], c: number[]) => {
    for (const v of [n, a, b, c]) {
      for (const k of v) {
        view.setFloat32(off, k, true)
        off += 4
      }
    }
    view.setUint16(off, 0, true)
    off += 2
  }
  // STL wants positive coordinates in most slicers; shift so the stencil sits at the origin corner.
  const s = STENCIL.outer / 2
  for (const b of boxes) {
    const [x0, x1, y0, y1, z0, z1] = [b.x0 + s, b.x1 + s, b.y0 + s, b.y1 + s, b.z0, b.z1]
    const p = (x: number, y: number, z: number) => [x, y, z]
    const c = [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)]
    // Counter-clockwise when seen from outside.
    tri([0, 0, -1], c[0], c[2], c[1]); tri([0, 0, -1], c[0], c[3], c[2])
    tri([0, 0, 1], c[4], c[5], c[6]); tri([0, 0, 1], c[4], c[6], c[7])
    tri([0, -1, 0], c[0], c[1], c[5]); tri([0, -1, 0], c[0], c[5], c[4])
    tri([0, 1, 0], c[3], c[7], c[6]); tri([0, 1, 0], c[3], c[6], c[2])
    tri([-1, 0, 0], c[0], c[4], c[7]); tri([-1, 0, 0], c[0], c[7], c[3])
    tri([1, 0, 0], c[1], c[2], c[6]); tri([1, 0, 0], c[1], c[6], c[5])
  }
  return new Uint8Array(buf)
}

/** Top-view SVG of the stencil (front at the bottom), for previews. */
export function stencilSvg(boxes: Box[], highlight: Map<string, number> = new Map()): string {
  const H = STENCIL.outer / 2
  const flipY = (y: number) => H - y
  const rect = (b: Box, fill: string) =>
    `<rect x="${(b.x0 + H).toFixed(2)}" y="${flipY(b.y1).toFixed(2)}" width="${(b.x1 - b.x0).toFixed(2)}" height="${(b.y1 - b.y0).toFixed(2)}" fill="${fill}"/>`
  const windows: string[] = []
  for (let row = 0; row < STENCIL.cells; row++) {
    for (let col = 0; col < STENCIL.cells; col++) {
      const n = highlight.get(`${String.fromCharCode(65 + col)}${row + 1}`)
      if (!n) continue
      const x = -INNER_HALF + col * CELL_MM
      const y = -INNER_HALF + row * CELL_MM
      windows.push(`<rect x="${(x + H).toFixed(2)}" y="${flipY(y + CELL_MM).toFixed(2)}" width="${CELL_MM}" height="${CELL_MM}" fill="#FF8A3D" opacity="${0.25 + 0.15 * n}"/>`)
    }
  }
  const body = boxes.map(b => rect(b, b.z0 > 0 ? '#1B2140' : '#8E9BD8')).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STENCIL.outer} ${STENCIL.outer}">${windows.join('')}${body}</svg>`
}
