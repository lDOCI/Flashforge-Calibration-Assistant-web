<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Plotly from 'plotly.js-dist-min'
import { plotlyConfig } from '@/lib/plotlyLocale'

const props = defineProps<{
  mesh: number[][]
  title?: string
}>()

const { t, locale } = useI18n()
const chartDiv = ref<HTMLDivElement>()

function getThemeColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    bg: style.getPropertyValue('--plot-bg').trim() || '#161925',
    paper: style.getPropertyValue('--plot-paper').trim() || '#0F111A',
    font: style.getPropertyValue('--plot-font').trim() || '#F7F9FF',
    text: style.getPropertyValue('--plot-text').trim() || '#8B92B0',
  }
}

function render() {
  if (!chartDiv.value || !props.mesh.length) return

  const c = getThemeColors()
  const rows = props.mesh.length
  const cols = props.mesh[0].length

  // No flip: row 0 = front of bed, at y=0 (bottom of chart)
  // Value annotations — adapt font size and precision to grid size
  const big = Math.max(rows, cols)
  const fontSize = big > 15 ? 6 : big > 8 ? 7 : big > 5 ? 9 : 10
  const decimals = big > 10 ? 2 : 3

  const annotations: Plotly.Annotations[] = []
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      annotations.push({
        x: j, y: i,
        text: props.mesh[i][j].toFixed(decimals),
        showarrow: false,
        font: { size: fontSize, color: c.font },
      })
    }
  }

  // Corner labels (localized)
  const fl = t('visual_rec.front_left')
  const fr = t('visual_rec.front_right')
  const bl = t('visual_rec.back_left')
  const br = t('visual_rec.back_right')
  annotations.push(
    { x: -0.4, y: -0.8, text: fl, showarrow: false, font: { size: 11, color: c.text }, xanchor: 'left', yanchor: 'top' },
    { x: cols - 0.6, y: -0.8, text: fr, showarrow: false, font: { size: 11, color: c.text }, xanchor: 'right', yanchor: 'top' },
    { x: -0.4, y: rows - 0.2, text: bl, showarrow: false, font: { size: 11, color: c.text }, xanchor: 'left', yanchor: 'bottom' },
    { x: cols - 0.6, y: rows - 0.2, text: br, showarrow: false, font: { size: 11, color: c.text }, xanchor: 'right', yanchor: 'bottom' },
  )

  const data: Plotly.Data[] = [{
    type: 'heatmap',
    z: props.mesh,
    colorscale: 'RdBu',
    reversescale: true,
    hovertemplate: `${t('neo_ui.plotly.row')} %{y}, ${t('neo_ui.plotly.col')} %{x}<br>%{z:.3f} ${t('neo_ui.units.mm')}<extra></extra>`,
    colorbar: {
      title: { text: t('neo_ui.units.mm'), font: { color: c.font, size: 11 } },
      tickfont: { color: c.text, size: 10 },
    },
  }]

  const layout: Partial<Plotly.Layout> = {
    title: { text: props.title || '', font: { color: c.font, size: 14 } },
    paper_bgcolor: c.paper,
    plot_bgcolor: c.bg,
    font: { color: c.font },
    margin: { t: props.title ? 40 : 30, b: 50, l: 16, r: 16 },
    annotations,
    xaxis: { visible: false, constrain: 'domain' },
    yaxis: { visible: false, scaleanchor: 'x', scaleratio: 1 },
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
  <div ref="chartDiv" class="heatmap-chart"></div>
</template>

<style scoped>
.heatmap-chart {
  width: 100%;
  min-height: 500px;
  border-radius: var(--radius-md);
  overflow: hidden;
}
</style>
