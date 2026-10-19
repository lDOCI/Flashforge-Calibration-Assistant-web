import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'bed',
      component: () => import('@/views/WizardView.vue'),
    },
    // Old links to the beta wizard
    { path: '/wizard', redirect: '/' },
    {
      path: '/shaper',
      name: 'shaper',
      component: () => import('@/views/InputShaperView.vue'),
    },
    {
      path: '/ssh',
      name: 'ssh',
      component: () => import('@/views/SSHView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
})

export default router
