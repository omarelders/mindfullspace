import { describe, it, expect } from 'vitest'
import { sanitizeUrl } from './urlSafety'
import { createId } from './id'

describe('sanitizeUrl', () => {
  it('allows http and https URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/')
    expect(sanitizeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1')
  })

  it('prepends https:// to protocol-less domains', () => {
    expect(sanitizeUrl('example.com')).toBe('https://example.com/')
    expect(sanitizeUrl('  example.com/page  ')).toBe('https://example.com/page')
  })

  it('rejects dangerous schemes', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeUrl('JaVaScRiPt:alert(1)')).toBeNull()
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull()
    expect(sanitizeUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects non-string and empty values', () => {
    expect(sanitizeUrl(null)).toBeNull()
    expect(sanitizeUrl(undefined)).toBeNull()
    expect(sanitizeUrl(42)).toBeNull()
    expect(sanitizeUrl({})).toBeNull()
    expect(sanitizeUrl('')).toBeNull()
    expect(sanitizeUrl('   ')).toBeNull()
  })
})

describe('createId', () => {
  it('uses the given prefix', () => {
    const id = createId('label')
    expect(id.startsWith('label-')).toBe(true)
  })

  it('generates unique ids even within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => createId('card')))
    expect(ids.size).toBe(5000)
  })
})
