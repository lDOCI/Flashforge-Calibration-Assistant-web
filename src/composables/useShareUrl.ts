import { useBedStore, type BedWorkspace } from '@/stores/bed'
import { encodePayload, type UrlPayload } from '@/lib/urlCodec'

/**
 * Compact mesh representation for URL sharing.
 * Uses short keys and flat arrays to minimize payload size.
 */
interface CompactMesh {
  n: string         // name
  x: number         // xCount
  y: number         // yCount
  b: number[]       // bounds [minX, maxX, minY, maxY]
  d: number[]       // flat matrix data (row-major), rounded to 3 decimals
}

function workspaceToCompact(ws: BedWorkspace): CompactMesh {
  const m = ws.meshData
  // Flatten matrix and round values
  const flat: number[] = []
  for (const row of m.matrix) {
    for (const val of row) {
      flat.push(Math.round(val * 1000) / 1000)
    }
  }
  return {
    n: ws.name,
    x: m.xCount,
    y: m.yCount,
    b: [m.minX, m.maxX, m.minY, m.maxY],
    d: flat,
  }
}

/**
 * Build a shareable URL containing all loaded bed workspaces.
 * Uses v2 compact format (mesh data only, no raw config text).
 */
export async function buildShareUrl(): Promise<string> {
  const bedStore = useBedStore()

  const meshes = bedStore.workspaces.map(workspaceToCompact)
  if (meshes.length === 0) {
    throw new Error('No data to share')
  }

  const payload: UrlPayload = {
    version: 2,
    compact: meshes,
  }

  const encoded = await encodePayload(payload)
  const base = window.location.origin + window.location.pathname + window.location.hash.split('?')[0]
  return `${base}?data=${encoded}`
}

export async function copyShareUrl(): Promise<void> {
  const url = await buildShareUrl()
  await navigator.clipboard.writeText(url)
}
