<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Plotly from 'plotly.js-dist-min'
import { plotlyConfig } from '@/lib/plotlyLocale'
import type { Spectrogram } from '@/lib/shaper/shaperCalibrate'

const props = defineProps<{
  spectrogram: Spectrogram
  title?: string
  /** Mark the recommended shaper frequency, Hz. */
  markFreq?: number
}>()

const { t, locale } = useI18n()
const chartDiv = ref<HTMLDivElement>()

// Inferno: dark = quiet, bright yellow = strong vibration.
const INFERNO: [number, string][] = [
  [0, '#0d0b1e'],
  [0.15, '#2a0b4f'],
  [0.35, '#6a176e'],
  [0.55, '#bb3754'],
  [0.75, '#f0702a'],
  [0.9, '#fbc33a'],
  [1, '#fcffa4'],
]

function render() {
  if (!chartDiv.value) return
  const s = getComputedStyle(document.documentElement)
  const c = {
    paper: s.getPropertyValue('--plot-paper').trim() || '#0F111A',
    font: s.getPropertyValue('--plot-font').trim() || '#F7F9FF',
    text: s.getPropertyValue('--plot-text').trim() || '#8B92B0',
    grid: s.getPropertyValue('--plot-grid').trim() || '#2B324A',
  }
  const sp = props.spectrogram
  // Compress brightness so weak features (the sweep, rattles, harmonics) stay
  // visible next to a strong resonance; 1 = strongest point of this test.
  const peak = Math.max(...sp.power.map(row => Math.max(...row)), 1e-12)
  const z = sp.power.map(row => row.map(v => Math.pow(v / peak, 0.4)))

  // @types/plotly.js lags the runtime (colorbar.title objects), hence the cast.
  const data = [
    {
      type: 'heatmap',
      x: sp.freqs,
      y: sp.times,
      z,
      zmin: 0,
      zmax: 1,
      zsmooth: 'best',
      colorscale: INFERNO,
      showscale: false,
      hovertemplate: `%{x:.0f} ${t('neo_ui.spectrogram.hz')} · %{y:.0f}%<extra></extra>`,
    },
  ] as unknown as Plotly.Data[]

  const shapes: Partial<Plotly.Shape>[] = props.markFreq
    ? [{
        type: 'line', x0: props.markFreq, x1: props.markFreq, y0: 0, y1: 100,
        line: { color: '#7CFFB2', width: 1.5, dash: 'dot' },
      }]
    : []

  const layout: Partial<Plotly.Layout> = {
    title: { text: props.title ?? '', font: { color: c.font, size: 13 }, x: 0.01, xanchor: 'left' },
    paper_bgcolor: c.paper,
    plot_bgcolor: c.paper,
    font: { color: c.text, size: 11 },
    margin: { t: props.title ? 36 : 12, b: 44, l: 52, r: 12 },
    xaxis: { title: { text: t('neo_ui.spectrogram.freq_axis') }, gridcolor: c.grid, range: [0, sp.freqs[sp.freqs.length - 1]] },
    yaxis: { title: { text: t('neo_ui.spectrogram.time_axis') }, gridcolor: c.grid, range: [0, 100] },
    shapes,
  }

  Plotly.react(chartDiv.value, data, layout, plotlyConfig(locale.value))
}

onMounted(render)
watch(() => [props.spectrogram, props.title, props.markFreq, locale.value], render)

const observer = new MutationObserver(render)
onMounted(() => observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }))
onUnmounted(() => observer.disconnect())
</script>

<template>
  <div ref="chartDiv" class="spectrogram-chart"></div>
</template>

<style scoped>
.spectrogram-chart {
  width: 100%;
  height: 380px;
  border-radius: var(--radius-md);
  overflow: hidden;
}
</style>
