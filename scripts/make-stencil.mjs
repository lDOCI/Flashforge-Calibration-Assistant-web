// Regenerates the universal tape stencil served by the app:
//   public/tape-stencil-5x5.stl  — print once on the PEI sheet (PLA, 0.2 mm layers)
//   public/tape-stencil-5x5.svg  — top-view preview shown in the tape step
// Usage: npm run stencil  (Node ≥ 23.6 runs the .ts layout file directly)
import { writeFileSync } from 'node:fs'
import { boxesToStl, stencilBoxes, stencilSvg } from '../src/lib/calibration/stencil.ts'

const boxes = stencilBoxes()
writeFileSync(new URL('../public/tape-stencil-5x5.stl', import.meta.url), boxesToStl(boxes))
writeFileSync(new URL('../public/tape-stencil-5x5.svg', import.meta.url), stencilSvg(boxes))
console.log(`stencil: ${boxes.length} boxes, ${boxes.length * 12} triangles`)
