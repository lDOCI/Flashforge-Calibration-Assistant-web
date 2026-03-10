import { useBedStore } from '@/stores/bed'
import { useShaperStore } from '@/stores/shaper'

export function useFileLoader() {
  const bedStore = useBedStore()
  const shaperStore = useShaperStore()

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const content = reader.result as string
      const name = file.name

      if (name.endsWith('.cfg') || name.endsWith('.conf')) {
        try {
          bedStore.loadFromConfig(content, name.replace(/\.(cfg|conf)$/, ''), name)
        } catch (e) {
          console.error('Failed to load config:', e)
          alert(`Failed to parse ${name}: ${e instanceof Error ? e.message : e}`)
        }
      } else if (name.endsWith('.csv')) {
        try {
          // Guess axis from filename
          const axis = name.toLowerCase().includes('_x') ? 'x' as const : 'y' as const
          shaperStore.loadCsv(axis, content)
        } catch (e) {
          console.error('Failed to load CSV:', e)
          alert(`Failed to parse ${name}: ${e instanceof Error ? e.message : e}`)
        }
      } else {
        alert('Unsupported file format. Use .cfg or .csv files.')
      }
    }
    reader.readAsText(file)
  }

  function triggerFileInput(accept: string = '.cfg,.conf,.csv') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = true
    input.onchange = () => {
      if (input.files) {
        for (const file of input.files) {
          handleFile(file)
        }
      }
    }
    input.click()
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer?.files) {
      for (const file of event.dataTransfer.files) {
        handleFile(file)
      }
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
  }

  return { handleFile, triggerFileInput, handleDrop, handleDragOver }
}
