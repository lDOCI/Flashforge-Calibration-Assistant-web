<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFileLoader } from '@/composables/useFileLoader'

const props = defineProps<{ startOpen?: boolean }>()

const { t } = useI18n()
const { triggerFileInput } = useFileLoader()
const baseUrl = import.meta.env.BASE_URL
const open = ref(props.startOpen ?? false)
</script>

<template>
  <section class="guide">
    <button class="guide-head" @click="open = !open">
      <span class="guide-title">{{ t('neo_ui.guide.title') }}</span>
      <span class="guide-chevron">{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" class="guide-body">
      <p class="guide-intro">{{ t('neo_ui.guide.intro') }}</p>

      <h3><span class="badge">1</span>{{ t('neo_ui.guide.measure_title') }}</h3>
      <ol>
        <li>{{ t('neo_ui.guide.measure_1') }}</li>
        <li>{{ t('neo_ui.guide.measure_2') }}</li>
      </ol>

      <h3><span class="badge">2</span>{{ t('neo_ui.guide.export_title') }}</h3>
      <ol>
        <li>{{ t('neo_ui.data.flash_step_1') }}</li>
        <li>{{ t('neo_ui.data.flash_step_2') }}</li>
        <li>{{ t('neo_ui.data.flash_step_3') }}</li>
        <li>{{ t('neo_ui.data.flash_step_4') }}</li>
        <li>{{ t('neo_ui.data.flash_step_5') }}</li>
      </ol>
      <div class="guide-images">
        <img :src="`${baseUrl}m1.jpg`" alt="Machine Info" loading="lazy" />
        <img :src="`${baseUrl}m2.jpg`" alt="Service Menu" loading="lazy" />
        <img :src="`${baseUrl}m3.jpg`" alt="Get Config" loading="lazy" />
      </div>
      <p class="guide-note">
        {{ t('neo_ui.guide.root_alt') }}
        <router-link to="/ssh">{{ t('neo_ui.guide.root_alt_link') }}</router-link>
      </p>

      <h3><span class="badge">3</span>{{ t('neo_ui.guide.load_title') }}</h3>
      <p class="guide-note">{{ t('neo_ui.guide.load_text') }}</p>
      <button class="guide-btn" @click="triggerFileInput('.cfg,.conf')">{{ t('settings_tab.get_printer_cfg') }}</button>
    </div>
  </section>
</template>

<style scoped>
.guide {
  margin-top: 12px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
}

.guide-head {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding: 10px 14px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  text-align: left;
}

.guide-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

.guide-chevron {
  color: var(--text-muted);
  font-size: 10px;
}

.guide-body {
  padding: 0 16px 16px;
}

.guide-intro,
.guide-note {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 4px 0 8px;
}

.guide-note a {
  color: var(--accent-primary);
}

h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 14px 0 6px;
}

.badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent-primary);
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

ol {
  margin: 0;
  padding-left: 22px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.guide-images {
  display: flex;
  gap: 8px;
  margin: 10px 0;
  flex-wrap: wrap;
}

.guide-images img {
  width: 180px;
  max-width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.guide-btn {
  padding: 8px 16px;
  background: var(--accent-primary);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
</style>
