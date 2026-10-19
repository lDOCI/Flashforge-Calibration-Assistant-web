<script setup lang="ts">
import AppLayout from '@/components/layout/AppLayout.vue'
import DragOverlay from '@/components/common/DragOverlay.vue'
import FirstLayerEgg from '@/components/common/FirstLayerEgg.vue'
import { useUrlData } from '@/composables/useUrlData'

useUrlData()
</script>

<template>
  <AppLayout />
  <DragOverlay />
  <FirstLayerEgg />
</template>
