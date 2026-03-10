<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBedStore } from '@/stores/bed'
import { useShaperStore } from '@/stores/shaper'
import { useFileLoader } from '@/composables/useFileLoader'
import StatCard from '@/components/common/StatCard.vue'
import FileDropZone from '@/components/common/FileDropZone.vue'

const { t } = useI18n()
const bedStore = useBedStore()
const shaperStore = useShaperStore()
const { handleDrop, handleDragOver } = useFileLoader()

const bedStats = computed(() => {
  const ws = bedStore.activeWorkspace
  if (!ws) return null
  const flat = ws.bed.meshData!.flat()
  const maxH = Math.max(...flat)
  const minH = Math.min(...flat)
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length
  return {
    delta: (maxH - minH).toFixed(3) + ' mm',
    mean: mean.toFixed(3) + ' mm',
  }
})

const workflowLabel = computed(() => {
  const ws = bedStore.activeWorkspace
  if (!ws?.workflow) return '\u2014'
  const best = ws.workflow.bestStage
  return `${t(best.label)} (${best.deviation.toFixed(3)} mm)`
})

const shaperLabel = computed(() => {
  const parts: string[] = []
  if (shaperStore.resultX) parts.push(`X: ${shaperStore.resultX.name.toUpperCase()} @ ${shaperStore.resultX.freq.toFixed(0)} Hz`)
  if (shaperStore.resultY) parts.push(`Y: ${shaperStore.resultY.name.toUpperCase()} @ ${shaperStore.resultY.freq.toFixed(0)} Hz`)
  return parts.length > 0 ? parts.join(' | ') : '\u2014'
})
</script>

<template>
  <div
    class="dashboard"
    @drop="handleDrop"
    @dragover="handleDragOver"
  >
    <h1>{{ t('neo_ui.dashboard.header') }}</h1>

    <div class="cards-grid">
      <StatCard
        :label="t('neo_ui.dashboard.cards.max_delta')"
        :value="bedStats?.delta ?? '\u2014'"
        accent="var(--accent-error)"
      />
      <StatCard
        :label="t('neo_ui.dashboard.cards.mean_height')"
        :value="bedStats?.mean ?? '\u2014'"
        accent="var(--accent-primary)"
      />
      <StatCard
        :label="t('neo_ui.dashboard.cards.workflow')"
        :value="workflowLabel"
      />
      <StatCard
        :label="t('neo_ui.dashboard.cards.shaper')"
        :value="shaperLabel"
      />
    </div>

    <div v-if="!bedStore.hasData" class="upload-section">
      <FileDropZone
        :label="t('neo_ui.bed.status.load_hint')"
        accept=".cfg,.conf,.csv"
      />
    </div>

    <div class="quick-actions">
      <h2>{{ t('neo_ui.dashboard.quick.title') }}</h2>
      <div class="actions-row">
        <router-link to="/bed" class="btn">{{ t('neo_ui.dashboard.quick.to_bed') }}</router-link>
        <router-link to="/shaper" class="btn">{{ t('neo_ui.dashboard.quick.to_shaper') }}</router-link>
        <router-link to="/settings" class="btn">{{ t('neo_ui.dashboard.quick.to_settings') }}</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 900px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

h2 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-bottom: 24px;
}

.upload-section {
  max-width: 400px;
  margin-bottom: 24px;
}

.actions-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
