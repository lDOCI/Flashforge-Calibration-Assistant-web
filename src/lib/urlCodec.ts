export interface CompactMesh {
  n: string         // name
  x: number         // xCount
  y: number         // yCount
  b: number[]       // bounds [minX, maxX, minY, maxY]
  d: number[]       // flat matrix data (row-major)
}

export interface UrlPayload {
  version: number
  // v2 compact format (mesh data only, no raw config text)
  compact?: CompactMesh[]
  // v1 CLI format
  configs?: Array<{ name: string; content: string }>
  // Legacy format
  meshes?: Array<{ name: string; configContent: string; timestamp?: number }>
  shaperCsvs?: Array<{
    name?: string
    axis?: 'x' | 'y'
    filename?: string
    content: string
  }>
}

// ===== v3 binary format =====
// Packs mesh data as int16 delta-encoded values.
// Much shorter than JSON after gzip.

const V3_MAGIC = 0x46   // 'F' for Flashforge
const SCALE = 10000      // 0.0001mm precision

function encodeBinaryV3(meshes: CompactMesh[]): Uint8Array {
  // Calculate total size
  let size = 2 // magic + mesh count
  for (const m of meshes) {
    const nameBytes = new TextEncoder().encode(m.n)
    size += 1 + nameBytes.length  // name length + name
    size += 2                      // xCount, yCount (uint8 each)
    size += 16                     // 4 × float32 bounds
    size += m.d.length * 2         // int16 per value (delta-encoded)
  }

  const buf = new ArrayBuffer(size)
  const view = new DataView(buf)
  const u8 = new Uint8Array(buf)
  let off = 0

  view.setUint8(off++, V3_MAGIC)
  view.setUint8(off++, meshes.length)

  for (const m of meshes) {
    const nameBytes = new TextEncoder().encode(m.n)
    view.setUint8(off++, nameBytes.length)
    u8.set(nameBytes, off)
    off += nameBytes.length

    view.setUint8(off++, m.x)
    view.setUint8(off++, m.y)

    // Bounds as float32
    view.setFloat32(off, m.b[0], true); off += 4
    view.setFloat32(off, m.b[1], true); off += 4
    view.setFloat32(off, m.b[2], true); off += 4
    view.setFloat32(off, m.b[3], true); off += 4

    // Delta-encode matrix values as int16
    let prev = 0
    for (const val of m.d) {
      const quantized = Math.round(val * SCALE)
      const delta = quantized - prev
      // Clamp to int16 range
      const clamped = Math.max(-32768, Math.min(32767, delta))
      view.setInt16(off, clamped, true)
      off += 2
      prev = quantized
    }
  }

  return u8
}

function decodeBinaryV3(bytes: Uint8Array): CompactMesh[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let off = 0

  const magic = view.getUint8(off++)
  if (magic !== V3_MAGIC) throw new Error('Invalid v3 magic byte')
  const meshCount = view.getUint8(off++)

  const meshes: CompactMesh[] = []
  for (let mi = 0; mi < meshCount; mi++) {
    const nameLen = view.getUint8(off++)
    const nameBytes = bytes.slice(off, off + nameLen)
    off += nameLen
    const name = new TextDecoder().decode(nameBytes)

    const x = view.getUint8(off++)
    const y = view.getUint8(off++)

    const b = [
      view.getFloat32(off, true), view.getFloat32(off + 4, true),
      view.getFloat32(off + 8, true), view.getFloat32(off + 12, true),
    ]
    off += 16

    const totalPoints = x * y
    const d: number[] = []
    let prev = 0
    for (let i = 0; i < totalPoints; i++) {
      const delta = view.getInt16(off, true)
      off += 2
      prev += delta
      d.push(prev / SCALE)
    }

    meshes.push({ n: name, x, y, b, d })
  }

  return meshes
}

// ===== gzip helpers =====

async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return bytes
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(bytes as unknown as BufferSource)
  writer.close()
  return collectStream(cs.readable)
}

async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream not available')
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(bytes as unknown as BufferSource)
  writer.close()
  return collectStream(ds.readable)
}

async function collectStream(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

// ===== Public API =====

/** Encode a payload for URL transfer. Uses v3 binary format for compact meshes. */
export async function encodePayload(data: UrlPayload): Promise<string> {
  // v3 binary path for compact mesh data
  if (data.compact && data.compact.length > 0) {
    const binary = encodeBinaryV3(data.compact)
    const compressed = await gzipCompress(binary)
    return uint8ToBase64url(compressed)
  }

  // Fallback: JSON for v1/legacy payloads
  const json = JSON.stringify(data)
  const bytes = new TextEncoder().encode(json)
  const compressed = await gzipCompress(bytes)
  return uint8ToBase64url(compressed)
}

/** Decode a URL payload (auto-detect v3 binary vs JSON). */
export async function decodePayload(encoded: string): Promise<UrlPayload> {
  let bytes: Uint8Array
  try {
    bytes = base64urlToUint8(encoded)
  } catch {
    const raw = atob(encoded)
    return JSON.parse(raw) as UrlPayload
  }

  // Decompress gzip if needed
  let data: Uint8Array
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    data = await gzipDecompress(bytes)
  } else {
    data = bytes
  }

  // Detect v3 binary format by magic byte
  if (data[0] === V3_MAGIC) {
    const meshes = decodeBinaryV3(data)
    return { version: 3, compact: meshes }
  }

  // Otherwise it's JSON (v1 or v2)
  const json = new TextDecoder().decode(data)
  return JSON.parse(json) as UrlPayload
}

// ---------- base64url helpers ----------

function uint8ToBase64url(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToUint8(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
