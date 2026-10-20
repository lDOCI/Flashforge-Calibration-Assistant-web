import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MeshData, WorkflowData } from '@/lib/calibration/types'
import { computeWorkflow } from '@/lib/calibration/workflow'
import { KlipperMeshParser, dropDuplicateMeshes, validateMeshData } from '@/lib/parsers/meshParser'
import { useSettingsStore } from './settings'
import { uid } from '@/lib/utils'

export interface BedWorkspace {
  id: string
  name: string
  meshData: MeshData
  workflow: WorkflowData | null
  timestamp: number
  sourceFile: string
}

export const useBedStore = defineStore('bed', () => {
  const workspaces = ref<BedWorkspace[]>([])
  const activeIndex = ref(0)

  const activeWorkspace = computed(() => workspaces.value[activeIndex.value] ?? null)
  const hasData = computed(() => workspaces.value.length > 0)

  function workflowFor(meshData: MeshData): WorkflowData | null {
    try {
      return computeWorkflow(meshData, useSettingsStore().settings)
    } catch (e) {
      console.error('Workflow computation failed:', e)
      return null
    }
  }

  function addWorkspace(meshData: MeshData, name: string, sourceFile: string) {
    workspaces.value.push({
      id: uid(),
      name,
      meshData,
      workflow: workflowFor(meshData),
      timestamp: Date.now(),
      sourceFile,
    })
    activeIndex.value = workspaces.value.length - 1
  }

  function loadFromConfig(content: string, name: string, sourceFile: string = 'printer.cfg') {
    const meshes = new KlipperMeshParser().parseAllMeshes(content)
    if (meshes.length === 0) throw new Error('Failed to parse printer.cfg — no mesh data found')

    const valid = dropDuplicateMeshes(meshes.filter(m => validateMeshData(m.meshData)))
    if (valid.length === 0) throw new Error('No valid mesh data found')
    for (const parsed of valid) {
      addWorkspace(parsed.meshData, valid.length > 1 ? `${name} (${parsed.name})` : name, sourceFile)
    }
  }

  /** Load directly from MeshData (compact share-link format). */
  function loadFromMeshData(meshData: MeshData, name: string) {
    if (!validateMeshData(meshData)) throw new Error(`Invalid mesh in shared link: ${name}`)
    addWorkspace(meshData, name, 'shared')
  }

  function setActive(index: number) {
    if (index >= 0 && index < workspaces.value.length) activeIndex.value = index
  }

  function removeWorkspace(index: number) {
    workspaces.value.splice(index, 1)
    if (activeIndex.value >= workspaces.value.length) {
      activeIndex.value = Math.max(0, workspaces.value.length - 1)
    }
  }

  function recomputeAllWorkflows() {
    for (const ws of workspaces.value) ws.workflow = workflowFor(ws.meshData)
  }

  return {
    workspaces,
    activeIndex,
    activeWorkspace,
    hasData,
    loadFromConfig,
    loadFromMeshData,
    setActive,
    removeWorkspace,
    recomputeAllWorkflows,
  }
})
