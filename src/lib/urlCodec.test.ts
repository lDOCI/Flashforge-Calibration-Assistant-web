import { describe, expect, it } from 'vitest'
import { decodePayload, encodePayload, type CompactMesh } from './urlCodec'

describe('share link codec', () => {
  it('round-trips a non-square mesh through v3', async () => {
    const mesh: CompactMesh = {
      n: 'Мой стол',
      x: 7,
      y: 5,
      b: [-105, 105, -105, 105],
      d: Array.from({ length: 35 }, (_, i) => Math.round((Math.sin(i) * 0.3) * 1000) / 1000),
    }
    const out = await decodePayload(await encodePayload({ version: 2, compact: [mesh] }))
    expect(out.compact?.[0].n).toBe(mesh.n)
    expect(out.compact?.[0].x).toBe(7)
    out.compact?.[0].d.forEach((v, i) => expect(v).toBeCloseTo(mesh.d[i], 4))
  })

  it('falls back to JSON instead of corrupting large jumps', async () => {
    const mesh: CompactMesh = { n: 'x', x: 2, y: 2, b: [0, 200, 0, 200], d: [0, 5, -5, 0] }
    const out = await decodePayload(await encodePayload({ version: 2, compact: [mesh] }))
    expect(out.compact?.[0].d).toEqual([0, 5, -5, 0])
  })
})
