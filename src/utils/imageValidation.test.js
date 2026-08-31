import { describe, expect, it } from 'vitest'
import { validateImageBlob } from './imageValidation'

const pngHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

describe('image validation', () => {
  it('accepts a real PNG with an allowed MIME type', async () => {
    const blob = new Blob([pngHeader, new Uint8Array([0, 1, 2])], { type: 'image/png' })

    await expect(validateImageBlob(blob)).resolves.toMatchObject({ valid: true, mimeType: 'image/png' })
  })

  it('rejects SVG content disguised as a PNG', async () => {
    const blob = new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/png' })

    await expect(validateImageBlob(blob)).resolves.toMatchObject({ valid: false })
  })

  it('rejects SVG MIME types even when the payload is an SVG', async () => {
    const blob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' })

    await expect(validateImageBlob(blob)).resolves.toMatchObject({ valid: false })
  })
})
