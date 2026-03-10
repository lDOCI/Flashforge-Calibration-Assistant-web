<script setup lang="ts">
import AppLayout from '@/components/layout/AppLayout.vue'
import { useUrlData } from '@/composables/useUrlData'

useUrlData()
</script>

<template>
  <AppLayout />
</template>
