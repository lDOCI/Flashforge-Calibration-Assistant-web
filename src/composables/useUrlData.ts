import { onMounted } from 'vue'
import { decodePayload, type CompactMesh } from '@/lib/urlCodec'
import { useBedStore } from '@/stores/bed'
import { useShaperStore } from '@/stores/shaper'
import type { MeshData } from '@/lib/calibration/types'

/** Reconstruct MeshData from compact representation */
function compactToMeshData(c: CompactMesh): MeshData {
  const matrix: number[][] = []
  for (let row = 0; row < c.y; row++) {
    matrix.push(c.d.slice(row * c.x, (row + 1) * c.x))
  }
  return {
    matrix,
    xCount: c.x,
    yCount: c.y,
    minX: c.b[0],
    maxX: c.b[1],
    minY: c.b[2],
    maxY: c.b[3],
  }
}

export function useUrlData() {
  onMounted(async () => {
    const params = new URLSearchParams(window.location.search)
    const data = params.get('data')
    if (!data) return

    try {
      const payload = await decodePayload(data)
      const bedStore = useBedStore()

      // v2 compact format — mesh data only, much shorter URLs
      if (payload.version === 2 && payload.compact) {
        for (const cm of payload.compact) {
          const meshData = compactToMeshData(cm)
          bedStore.loadFromMeshData(meshData, cm.n)
        }
      } else {
        // v1 / legacy formats: full config content
        const configs = payload.configs ?? payload.meshes ?? []
        for (const cfg of configs) {
          const content = (cfg as any).content ?? (cfg as any).configContent
          const name = cfg.name ?? 'printer.cfg'
          if (content) {
            bedStore.loadFromConfig(content, name.replace(/\.(cfg|conf)$/, ''), name)
          }
        }
      }

      if (payload.shaperCsvs) {
        const shaperStore = useShaperStore()
        for (const csv of payload.shaperCsvs) {
          const axis = csv.axis ?? (csv.name?.toLowerCase().includes('_x') ? 'x' : 'y')
          shaperStore.loadCsv(axis, csv.content)
        }
      }

      // Clean URL
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState(null, '', cleanUrl)
    } catch (e) {
      console.error('Failed to decode URL data:', e)
    }
  })
}
