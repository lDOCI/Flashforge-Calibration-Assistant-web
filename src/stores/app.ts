import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const theme = ref<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
  )
  const statusMessage = ref('')

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', theme.value)
    applyTheme()
  }

  function applyTheme() {
    if (theme.value === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }

  function setStatus(msg: string) {
    statusMessage.value = msg
  }

  // Apply on init
  applyTheme()

  return { theme, statusMessage, toggleTheme, applyTheme, setStatus }
})
