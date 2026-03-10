<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Plotly from 'plotly.js-dist-min'
import { linspace } from '@/lib/utils'
import { plotlyConfig } from '@/lib/plotlyLocale'

const props = defineProps<{
  mesh: number[][]
  title?: string
  interpolationPoints?: number
}>()

const { t, locale } = useI18n()
const chartDiv = ref<HTMLDivElement>()

function getColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    bg: s.getPropertyValue('--plot-bg').trim() || '#161925',
    paper: s.getPropertyValue('--plot-paper').trim() || '#0F111A',
    font: s.getPropertyValue('--plot-font').trim() || '#F7F9FF',
    text: s.getPropertyValue('--plot-text').trim() || '#8B92B0',
    grid: s.getPropertyValue('--plot-grid').trim() || '#2B324A',
  }
}

/** Bilinear interpolation of a 2D grid to a denser grid */
function interpolateMesh(mesh: number[][], targetSize: number): number[][] {
  const rows = mesh.length
  const cols = mesh[0].length
  if (rows < 2 || cols < 2) return mesh

  const result: number[][] = []
  for (let i = 0; i < targetSize; i++) {
    const row: number[] = []
    const yFrac = (i / (targetSize - 1)) * (rows - 1)
    const y0 = Math.floor(yFrac)
    const y1 = Math.min(y0 + 1, rows - 1)
    const fy = yFrac - y0

    for (let j = 0; j < targetSize; j++) {
      const xFrac = (j / (targetSize - 1)) * (cols - 1)
      const x0 = Math.floor(xFrac)
      const x1 = Math.min(x0 + 1, cols - 1)
      const fx = xFrac - x0

      // Bilinear
      const v = mesh[y0][x0] * (1 - fx) * (1 - fy)
            + mesh[y0][x1] * fx * (1 - fy)
            + mesh[y1][x0] * (1 - fx) * fy
            + mesh[y1][x1] * fx * fy
      row.push(v)
    }
    result.push(row)
  }
  return result
}

function render() {
  if (!chartDiv.value || !props.mesh.length) return
  const c = getColors()
  const rows = props.mesh.length
  const cols = props.mesh[0].length

  const interpSize = props.interpolationPoints ?? 100
  const interpolated = interpolateMesh(props.mesh, interpSize)

  // Generate axis values in physical coordinates
  const xVals = linspace(0, cols - 1, interpSize)
  const yVals = linspace(0, rows - 1, interpSize)

  const data: Plotly.Data[] = [{
    type: 'surface',
    z: interpolated,
    x: xVals,
    y: yVals,
    colorscale: 'RdBu',
    reversescale: true,
    contours: {
      z: { show: true, usecolormap: true, project: { z: false } },
    },
    hovertemplate: '%{z:.3f} mm<extra></extra>',
    colorbar: {
      title: { text: t('neo_ui.units.mm'), font: { color: c.font, size: 11 } },
      tickfont: { color: c.text, size: 10 },
    },
  }]

  // Corner labels as 3D scatter text
  const fl = t('visual_rec.front_left')
  const fr = t('visual_rec.front_right')
  const bl = t('visual_rec.back_left')
  const br = t('visual_rec.back_right')
  const zMin = Math.min(...props.mesh.flat()) - 0.05

  data.push({
    type: 'scatter3d',
    mode: 'text',
    x: [0, cols - 1, 0, cols - 1],
    y: [0, 0, rows - 1, rows - 1],
    z: [zMin, zMin, zMin, zMin],
    text: [fl, fr, bl, br],
    textfont: { size: 10, color: c.text },
    hoverinfo: 'skip',
    showlegend: false,
  } as any)

  const layout: Partial<Plotly.Layout> = {
    title: { text: props.title || '', font: { color: c.font, size: 14 } },
    paper_bgcolor: c.paper,
    scene: {
      bgcolor: c.bg,
      xaxis: { gridcolor: c.grid, color: c.text, title: '', showticklabels: false },
      yaxis: { gridcolor: c.grid, color: c.text, title: '', showticklabels: false },
      zaxis: { gridcolor: c.grid, color: c.text, title: { text: t('neo_ui.units.mm'), font: { color: c.text } } },
      camera: { eye: { x: -1.5, y: -1.5, z: 1.0 } },
      aspectmode: 'manual',
      aspectratio: { x: 1, y: 1, z: 0.5 },
    },
    margin: { t: props.title ? 40 : 16, b: 10, l: 10, r: 10 },
  }

  Plotly.react(chartDiv.value, data, layout, plotlyConfig(locale.value))
}

onMounted(render)
watch(() => props.mesh, render, { deep: true })
watch(() => props.title, render)

const observer = new MutationObserver(render)
onMounted(() => {
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onUnmounted(() => observer.disconnect())
</script>

<template>
  <div ref="chartDiv" class="surface-chart"></div>
</template>

<style scoped>
.surface-chart {
  width: 100%;
  min-height: 500px;
  border-radius: var(--radius-md);
  overflow: hidden;
}
</style>
