/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module 'plotly.js-dist-min' {
  import type Plotly from 'plotly.js'
  export = Plotly
}
