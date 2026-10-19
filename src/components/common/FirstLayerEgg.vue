<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Easter egg: a nozzle zig-zags across the screen and lays down a perfect
 * first layer. Trigger: Konami code, or tapping the logo 7 times
 * (TopBar dispatches `ff-easter-egg`).
 */
const { t, tm } = useI18n()
const active = ref(false)
const done = ref(false)
const message = ref('')
const canvas = ref<HTMLCanvasElement>()

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
let progress = 0
let frame = 0
let closeTimer = 0

function onKey(e: KeyboardEvent) {
  if (active.value) {
    if (e.key === 'Escape' && done.value) close()
    return
  }
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  progress = key === KONAMI[progress] ? progress + 1 : key === KONAMI[0] ? 1 : 0
  if (progress === KONAMI.length) {
    progress = 0
    start()
  }
}

function pickMessage() {
  const msgs = tm('neo_ui.footer.egg') as unknown
  const list = Array.isArray(msgs) ? (msgs as string[]) : []
  message.value = list.length ? list[Math.floor(Math.random() * list.length)] : ''
}

async function start() {
  if (active.value) return
  pickMessage()
  active.value = true
  done.value = false
  await nextTick()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish()
  print()
}

function finish() {
  done.value = true
  clearTimeout(closeTimer)
  closeTimer = window.setTimeout(close, 6000)
}

function close() {
  cancelAnimationFrame(frame)
  clearTimeout(closeTimer)
  active.value = false
}

function print() {
  const c = canvas.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  const W = window.innerWidth
  const H = window.innerHeight
  c.width = W * dpr
  c.height = H * dpr
  const ctx = c.getContext('2d')!
  ctx.scale(dpr, dpr)

  // Layer area and boustrophedon tool path, like a real slicer's first layer.
  const w = Math.min(560, W - 48)
  const h = Math.min(150, H * 0.25)
  const x0 = (W - w) / 2
  const y0 = (H - h) / 2
  const pitch = 7
  const pts: [number, number][] = []
  for (let i = 0, y = y0; y <= y0 + h; i++, y += pitch) {
    pts.push(i % 2 ? [x0 + w, y] : [x0, y], i % 2 ? [x0, y] : [x0 + w, y])
  }
  const total = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
  const speed = total / 2600 // px per ms → about 2.6 s per layer
  let t0 = 0

  const step = (now: number) => {
    if (!t0) t0 = now
    const dist = Math.min(total, (now - t0) * speed)
    ctx.clearRect(0, 0, W, H)

    // build plate
    ctx.fillStyle = 'rgba(244, 246, 255, 0.08)'
    ctx.fillRect(x0 - 16, y0 - 16, w + 32, h + 32)

    // extruded filament
    ctx.lineWidth = pitch - 1
    ctx.lineCap = 'round'
    let walked = 0
    let head: [number, number] = pts[0]
    for (let i = 1; i < pts.length && walked < dist; i++) {
      const [ax, ay] = pts[i - 1]
      const [bx, by] = pts[i]
      const len = Math.hypot(bx - ax, by - ay)
      const k = Math.min(1, (dist - walked) / len)
      head = [ax + (bx - ax) * k, ay + (by - ay) * k]
      // One filament colour; alternate passes a touch darker, like real extrusion lines.
      ctx.strokeStyle = i % 4 < 2 ? '#FF8A3D' : '#E9772E'
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(head[0], head[1])
      ctx.stroke()
      walked += len
    }

    // nozzle
    const [nx, ny] = head
    ctx.fillStyle = '#FF8A3D'
    ctx.fillRect(nx - 16, ny - 46, 32, 22)
    ctx.fillStyle = '#FFC27A'
    ctx.beginPath()
    ctx.moveTo(nx - 9, ny - 24)
    ctx.lineTo(nx + 9, ny - 24)
    ctx.lineTo(nx + 3, ny - 6)
    ctx.lineTo(nx - 3, ny - 6)
    ctx.closePath()
    ctx.fill()

    if (dist < total) frame = requestAnimationFrame(step)
    else finish()
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('ff-easter-egg', start)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('ff-easter-egg', start)
  close()
})
</script>

<template>
  <Transition name="egg">
    <div v-if="active" class="egg">
      <canvas ref="canvas" class="egg-canvas" />
      <Transition name="egg">
        <div v-if="done" class="egg-text">
          <b>{{ t('neo_ui.egg.title') }}</b>
          <span>{{ t('neo_ui.egg.range') }}</span>
          <span v-if="message" class="egg-msg">{{ message }}</span>
          <button class="egg-close" @click="close">{{ t('neo_ui.egg.close') }}</button>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.egg {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(8, 10, 18, 0.92);
}

.egg-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.egg-text {
  position: absolute;
  left: 50%;
  top: calc(50% + min(150px, 25vh) / 2 + 40px);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: calc(100% - 32px);
  text-align: center;
  color: #cfd6ff;
  font-size: 13px;
}

.egg-text b {
  font-size: 24px;
  color: #fff;
}

.egg-close {
  margin-top: 10px;
  padding: 6px 18px;
  background: transparent;
  border: 1px solid #FF8A3D;
  border-radius: 999px;
  color: #FFB25B;
  font-size: 13px;
  cursor: pointer;
}

.egg-msg {
  font-style: italic;
  color: #FFB25B;
}

.egg-enter-active,
.egg-leave-active {
  transition: opacity 0.35s ease;
}

.egg-enter-from,
.egg-leave-to {
  opacity: 0;
}
</style>
