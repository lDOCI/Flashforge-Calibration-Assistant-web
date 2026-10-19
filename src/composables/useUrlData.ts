import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { decodePayload, type CompactMesh, type UrlPayload } from '@/lib/urlCodec'
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
function loadPayload(payload: UrlPayload) {
  const bedStore = useBedStore()
  // Links come from anywhere: load what is valid and skip the rest.
  const attempt = (what: string, fn: () => void) => {
    try {
      fn()
    } catch (e) {
      console.error(`Skipping ${what} from shared link:`, e)
    }
  }

  // v2/v3 compact format — mesh data only
  for (const cm of payload.compact ?? []) {
    attempt(String(cm?.n), () => bedStore.loadFromMeshData(compactToMeshData(cm), String(cm.n ?? 'mesh')))
  }

  // v1 / legacy formats: full config content
  const configs = [
    ...(payload.configs ?? []).map(c => ({ name: c.name, content: c.content })),
    ...(payload.meshes ?? []).map(m => ({ name: m.name, content: m.configContent })),
  ]
  for (const cfg of configs) {
    const name = cfg.name ?? 'printer.cfg'
    if (cfg.content) {
      attempt(name, () => bedStore.loadFromConfig(cfg.content, name.replace(/\.(cfg|conf)$/, ''), name))
    }
  }

  if (payload.shaperCsvs) {
    const shaperStore = useShaperStore()
    for (const csv of payload.shaperCsvs) {
      const axis = csv.axis ?? (csv.name?.toLowerCase().includes('_x') ? 'x' : 'y')
      attempt(csv.name ?? axis, () => shaperStore.loadCsv(axis, csv.content))
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
