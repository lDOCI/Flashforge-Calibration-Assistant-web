<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="root-notice" role="note">
    <b>{{ t('neo_ui.shaper.root_title') }}</b>
    <span>{{ t('neo_ui.shaper.root_text') }}</span>
    <ol>
      <li>{{ t('neo_ui.shaper.root_step_1') }}</li>
      <li>{{ t('neo_ui.shaper.root_step_2') }}</li>
      <li>{{ t('neo_ui.shaper.root_step_3') }}</li>
    </ol>
    <router-link to="/ssh">{{ t('neo_ui.guide.root_alt_link') }}</router-link>
  </div>
</template>

<style scoped>
.root-notice {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: var(--card-bg);
  border: 1px solid var(--status-warn);
  border-left-width: 4px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.root-notice b {
  color: var(--text-primary);
  font-size: 13px;
}

.root-notice ol {
  margin: 2px 0;
  padding-left: 20px;
}

.root-notice a {
  color: var(--accent-primary);
  align-self: flex-start;
}
</style>
