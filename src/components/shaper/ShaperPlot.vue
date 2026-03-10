<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Plotly from 'plotly.js-dist-min'
import { plotlyConfig } from '@/lib/plotlyLocale'
import type { CalibrationData, CalibrationResult } from '@/lib/shaper/types'

const props = defineProps<{
  calibrationData: CalibrationData
  allShapers: CalibrationResult[]
  selectedShaper: string
  title?: string
  maxFreq?: number
}>()

const { t, locale } = useI18n()
const chartDiv = ref<HTMLDivElement>()

function getThemeColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    bg: style.getPropertyValue('--plot-bg').trim() || '#161925',
    paper: style.getPropertyValue('--plot-paper').trim() || '#0F111A',
    grid: style.getPropertyValue('--plot-grid').trim() || '#2B324A',
    font: style.getPropertyValue('--plot-font').trim() || '#F7F9FF',
    text: style.getPropertyValue('--plot-text').trim() || '#8B92B0',
  }
}

function render() {
  if (!chartDiv.value || !props.calibrationData) return

  const colors = getThemeColors()
  const freq = props.calibrationData.freqBins
  const maxF = props.maxFreq ?? 200

  // Filter to maxFreq
  const mask = freq.map(f => f <= maxF)
  const fFiltered = freq.filter((_, i) => mask[i])
  const psdSum = props.calibrationData.psdSum.filter((_, i) => mask[i])
  const psdX = props.calibrationData.psdX.filter((_, i) => mask[i])
  const psdY = props.calibrationData.psdY.filter((_, i) => mask[i])
  const psdZ = props.calibrationData.psdZ.filter((_, i) => mask[i])

  const traces: Plotly.Data[] = [
    { x: fFiltered, y: psdSum, name: 'X+Y+Z', line: { color: '#9b59b6', width: 2 }, yaxis: 'y' },
    { x: fFiltered, y: psdX, name: 'X', line: { color: '#e74c3c', width: 1.5 }, yaxis: 'y' },
    { x: fFiltered, y: psdY, name: 'Y', line: { color: '#2ecc71', width: 1.5 }, yaxis: 'y' },
    { x: fFiltered, y: psdZ, name: 'Z', line: { color: '#3498db', width: 1.5 }, yaxis: 'y' },
  ]

  // Add shaper response curves
  let bestShaperVals: number[] | null = null
  for (const shaper of props.allShapers) {
    if (!shaper.vals || shaper.vals.length === 0) continue
    const shaperVals = shaper.vals.filter((_, i) => mask[i])
    const isSelected = shaper.name === props.selectedShaper

    const label = `${shaper.name.toUpperCase()} (${shaper.freq.toFixed(1)} Hz, vibr=${(shaper.vibrs * 100).toFixed(1)}%)`

    traces.push({
      x: fFiltered,
      y: shaperVals,
      name: label,
      line: { dash: isSelected ? 'dashdot' : 'dot', width: isSelected ? 2 : 1 },
      yaxis: 'y2',
    })

    if (isSelected) {
      bestShaperVals = shaperVals
    }
  }

  // "After shaper" trace
  if (bestShaperVals) {
    const afterShaper = psdSum.map((v, i) => v * bestShaperVals![i])
    traces.push({
      x: fFiltered,
      y: afterShaper,
      name: t('shaper_graphs.after_shaper'),
      line: { color: '#00bcd4', width: 2 },
      yaxis: 'y',
      fill: 'tozeroy',
      fillcolor: 'rgba(0,188,212,0.1)',
    })
  }

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: props.title || '',
      font: { color: colors.font, size: 14 },
    },
    paper_bgcolor: colors.paper,
    plot_bgcolor: colors.bg,
    font: { color: colors.font, size: 11 },
    margin: { t: 40, b: 50, l: 60, r: 60 },
    legend: {
      font: { size: 10, color: colors.text },
      bgcolor: 'rgba(0,0,0,0)',
      orientation: 'h',
      xanchor: 'left',
      yanchor: 'top',
      x: 0,
      y: -0.2,
    },
    xaxis: {
      title: { text: t('shaper_graphs.frequency_hz'), font: { color: colors.text, size: 11 } },
      range: [0, maxF],
      gridcolor: colors.grid,
      tickfont: { color: colors.text },
      dtick: 25,
      minor: { dtick: 5, gridcolor: 'rgba(43,50,74,0.4)' },
    },
    yaxis: {
      title: { text: t('shaper_graphs.power_spectral_density'), font: { color: colors.text, size: 11 } },
      gridcolor: colors.grid,
      tickfont: { color: colors.text },
      exponentformat: 'e',
      rangemode: 'tozero',
    },
    yaxis2: {
      title: { text: t('shaper_graphs.vibration_reduction'), font: { color: colors.text, size: 11 } },
      overlaying: 'y',
      side: 'right',
      gridcolor: 'transparent',
      tickfont: { color: colors.text },
      rangemode: 'tozero',
    },
  }

  Plotly.react(chartDiv.value, traces, layout, plotlyConfig(locale.value))
}

onMounted(render)
watch(() => [props.calibrationData, props.allShapers, props.selectedShaper], render, { deep: true })

// Re-render on theme change
const observer = new MutationObserver(render)
onMounted(() => {
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})
</script>

<template>
  <div ref="chartDiv" class="shaper-chart"></div>
</template>

<style scoped>
.shaper-chart {
  width: 100%;
  height: 500px;
  border-radius: var(--radius-md);
  overflow: hidden;
}
</style>
