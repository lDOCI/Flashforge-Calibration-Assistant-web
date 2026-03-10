import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MeshData, WorkflowData } from '@/lib/calibration/types'
import { Bed } from '@/lib/calibration/bed'
import { ScrewSolver } from '@/lib/calibration/screwSolver'
import { DeviationAnalyzer } from '@/lib/calibration/deviationAnalyzer'
import { TapeCalculator } from '@/lib/calibration/tapeCalculator'
import { computeWorkflow } from '@/lib/calibration/workflow'
import { KlipperMeshParser } from '@/lib/parsers/meshParser'
import { useSettingsStore } from './settings'
import { uid } from '@/lib/utils'

export interface BedWorkspace {
  id: string
  name: string
  meshData: MeshData
  bed: Bed
  analyzer: DeviationAnalyzer
  screwSolver: ScrewSolver
  tapeCalculator: TapeCalculator
  workflow: WorkflowData | null
  timestamp: number
  sourceFile: string
  sourceContent: string
}

export const useBedStore = defineStore('bed', () => {
  const workspaces = ref<BedWorkspace[]>([])
  const activeIndex = ref(0)

  const activeWorkspace = computed(() =>
    workspaces.value.length > 0 ? workspaces.value[activeIndex.value] : null,
  )

  const hasData = computed(() => workspaces.value.length > 0)

  function createWorkspace(meshData: MeshData, name: string, sourceFile: string, content: string): BedWorkspace {
    const settingsStore = useSettingsStore()
    const s = settingsStore.settings

    const bedConfig = {
      sizeX: meshData.maxX - meshData.minX,
      sizeY: meshData.maxY - meshData.minY,
      meshPointsX: meshData.xCount,
      meshPointsY: meshData.yCount,
    }

    const bed = new Bed(bedConfig)
    bed.setMeshData(meshData.matrix)

    const screwConfig = {
      type: 'M4',
      pitch: s.hardware.screw_pitch,
      minAdjust: s.hardware.min_adjustment,
      maxAdjust: s.hardware.max_adjustment,
    }

    const analyzer = new DeviationAnalyzer(
      bed,
      s.hardware.corner_averaging,
      s.thresholds.screw_threshold,
      s.thresholds.tape_threshold,
      screwConfig,
    )

    const screwSolver = new ScrewSolver(bed, screwConfig)
    const tapeCalculator = new TapeCalculator(bed, s.hardware.tape_thickness)

    let workflow: WorkflowData | null = null
    try {
      workflow = computeWorkflow(bed, analyzer, screwSolver, tapeCalculator, s)
    } catch (e) {
      console.error('Workflow computation failed:', e)
    }

    return {
      id: uid(),
      name,
      meshData,
      bed,
      analyzer,
      screwSolver,
      tapeCalculator,
      workflow,
      timestamp: Date.now(),
      sourceFile,
      sourceContent: content,
    }
  }

  function loadFromConfig(content: string, name: string, sourceFile: string = 'printer.cfg') {
    const parser = new KlipperMeshParser()
    const meshes = parser.parseAllMeshes(content)

    if (meshes.length === 0) throw new Error('Failed to parse printer.cfg — no mesh data found')

    for (const parsed of meshes) {
      if (!parser.validateMeshData(parsed.meshData)) continue

      const wsName = meshes.length > 1
        ? `${name} (${parsed.name})`
        : name

      const workspace = createWorkspace(parsed.meshData, wsName, sourceFile, content)
      workspaces.value.push(workspace)
    }

    if (workspaces.value.length === 0) throw new Error('No valid mesh data found')
    activeIndex.value = workspaces.value.length - 1
  }

  /** Load directly from MeshData (used by compact URL format) */
  function loadFromMeshData(meshData: MeshData, name: string) {
    const workspace = createWorkspace(meshData, name, 'shared', '')
    workspaces.value.push(workspace)
    activeIndex.value = workspaces.value.length - 1
  }

  function setActive(index: number) {
    if (index >= 0 && index < workspaces.value.length) {
      activeIndex.value = index
    }
  }

  function removeWorkspace(index: number) {
    workspaces.value.splice(index, 1)
    if (activeIndex.value >= workspaces.value.length) {
      activeIndex.value = Math.max(0, workspaces.value.length - 1)
    }
  }

  function recomputeAllWorkflows() {
    const settingsStore = useSettingsStore()
    const s = settingsStore.settings

    for (const ws of workspaces.value) {
      const screwConfig = {
        type: 'M4',
        pitch: s.hardware.screw_pitch,
        minAdjust: s.hardware.min_adjustment,
        maxAdjust: s.hardware.max_adjustment,
      }

      ws.screwSolver.setScrewConfig(screwConfig)
      ws.analyzer.setScrewConfig(screwConfig)
      ws.analyzer.screwThreshold = s.thresholds.screw_threshold
      ws.analyzer.tapeThreshold = s.thresholds.tape_threshold
      ws.analyzer.setCornerAveragingSize(s.hardware.corner_averaging)
      ws.tapeCalculator.tapeThickness = s.hardware.tape_thickness

      try {
        ws.workflow = computeWorkflow(
          ws.bed, ws.analyzer, ws.screwSolver, ws.tapeCalculator, s,
        )
      } catch (e) {
        console.error('Workflow recomputation failed:', e)
      }
    }
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
