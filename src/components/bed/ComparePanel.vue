<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBedStore } from '@/stores/bed'
import { useSettingsStore } from '@/stores/settings'
import { addScaled, gridOf, meshPlane, rangeOf, resample } from '@/lib/calibration/grid'
import BedHeatmap from './BedHeatmap.vue'

const { t } = useI18n()
const bedStore = useBedStore()
const settingsStore = useSettingsStore()

const expanded = ref(false)
const idA = ref<string | null>(null)
const idB = ref<string | null>(null)

// Default to the two most recent meshes; drop selections that were removed.
watch(
  () => bedStore.workspaces.map(w => w.id),
  ids => {
    if (!idA.value || !ids.includes(idA.value)) idA.value = ids[ids.length - 2] ?? null
    if (!idB.value || !ids.includes(idB.value)) idB.value = ids[ids.length - 1] ?? null
  },
  { immediate: true },
)

const diff = computed(() => {
  const a = bedStore.workspaces.find(w => w.id === idA.value)
  const b = bedStore.workspaces.find(w => w.id === idB.value)
  if (!a || !b || a === b) return null

  const g = settingsStore.settings.geometry
  const gridA = gridOf(a.meshData, g.bed_size_x, g.bed_size_y)
  const gridB = gridOf(b.meshData, g.bed_size_x, g.bed_size_y)
  // Meshes may have different densities; compare on A's nodes.
  const bOnA = resample(gridB, b.meshData.matrix, gridA)
  const d = addScaled(bOnA, a.meshData.matrix, -1)
  const plane = meshPlane(gridA, d)
  return {
    mesh: d,
    range: rangeOf(d),
    tilt: rangeOf(plane),
    shape: rangeOf(addScaled(d, plane, -1)),
  }
})
</script>

<template>
  <div class="cmp-panel">
    <div class="cmp-header" @click="expanded = !expanded">
      <span class="cmp-title">{{ t('neo_ui.compare.title') }}</span>
      <span class="cmp-chevron">{{ expanded ? '▾' : '▸' }}</span>
    </div>

    <div v-if="expanded" class="cmp-body">
      <p class="cmp-desc">{{ t('neo_ui.compare.hint') }}</p>

      <p v-if="bedStore.workspaces.length < 2" class="cmp-empty">{{ t('neo_ui.compare.need_two') }}</p>

      <template v-else>
        <div class="cmp-pickers">
          <label>
            <span>{{ t('neo_ui.compare.base') }}</span>
            <select v-model="idA">
              <option v-for="w in bedStore.workspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
          </label>
          <label>
            <span>{{ t('neo_ui.compare.other') }}</span>
            <select v-model="idB">
              <option v-for="w in bedStore.workspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
          </label>
        </div>

        <div v-if="diff" class="cmp-stats">
          <div><span>{{ t('neo_ui.compare.range') }}</span><b>{{ diff.range.toFixed(3) }} mm</b></div>
          <div><span>{{ t('neo_ui.compare.tilt') }}</span><b>{{ diff.tilt.toFixed(3) }} mm</b></div>
          <div><span>{{ t('neo_ui.compare.shape') }}</span><b>{{ diff.shape.toFixed(3) }} mm</b></div>
        </div>
        <BedHeatmap v-if="diff" :mesh="diff.mesh" :title="t('neo_ui.compare.diff_title')" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.cmp-panel {
  margin-top: 12px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.cmp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.cmp-header:hover {
  background: var(--bg-hover);
}

.cmp-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex: 1;
}

.cmp-chevron {
  color: var(--text-muted);
  font-size: 10px;
}

.cmp-body {
  padding: 0 14px 14px;
}

.cmp-desc,
.cmp-empty {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 10px;
  line-height: 1.5;
}

.cmp-pickers {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.cmp-pickers label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  min-width: 0;
}

.cmp-pickers select {
  max-width: 100%;
  padding: 4px 8px;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.cmp-stats {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 11px;
  color: var(--text-muted);
}

.cmp-stats div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cmp-stats b {
  font-size: 14px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
</style>
