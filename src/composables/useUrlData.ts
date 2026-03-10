import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
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

/** Load decoded payload into stores */
function loadPayload(payload: any) {
  const bedStore = useBedStore()

  // v2/v3 compact format — mesh data only
  if (payload.compact && payload.compact.length > 0) {
    for (const cm of payload.compact) {
      const meshData = compactToMeshData(cm)
      bedStore.loadFromMeshData(meshData, cm.n)
    }
  }

  // v1 / legacy formats: full config content
  if (payload.configs || payload.meshes) {
    const configs = payload.configs ?? payload.meshes ?? []
    for (const cfg of configs) {
      const content = cfg.content ?? cfg.configContent
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
}

export function useUrlData() {
  const router = useRouter()

  onMounted(async () => {
    await router.isReady()
    const route = router.currentRoute.value

    // Data encoded in URL (share links)
    const data = new URLSearchParams(window.location.search).get('data')
      || (route.query.data as string)
      || null
    if (!data) return

    try {
      const payload = await decodePayload(data)
      loadPayload(payload)
      const cleanUrl = window.location.origin + window.location.pathname + (window.location.hash || '#/')
      window.history.replaceState(null, '', cleanUrl)
    } catch (e) {
      console.error('Failed to decode URL data:', e)
    }
  })
}
