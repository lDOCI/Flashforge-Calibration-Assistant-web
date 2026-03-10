import { useAppStore } from '@/stores/app'

export function useTheme() {
  const appStore = useAppStore()
  return {
    theme: appStore.theme,
    toggleTheme: () => appStore.toggleTheme(),
  }
}
