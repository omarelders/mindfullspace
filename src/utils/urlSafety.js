const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Normalize a user/imported URL to a safe absolute http(s) URL.
 *
 * Returns the normalized href, or null when the value is not a string,
 * is empty, or uses a dangerous scheme (javascript:, data:, vbscript:, ...).
 * Protocol-less values ("example.com") are assumed to be https.
 *
 * This must be applied at every store/render boundary (form submit, JSON
 * import, workspace load) — never trust a URL just because it came from
 * "our own" localStorage or backup file.
 */
export function sanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  let candidate = trimmed
  try {
    const parsed = new URL(candidate)
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null
    return parsed.href
  } catch {
    // No protocol (or unparseable) — retry as an https:// host.
  }

  try {
    const parsed = new URL(`https://${candidate}`)
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null
    return parsed.href
  } catch {
    return null
  }
}
