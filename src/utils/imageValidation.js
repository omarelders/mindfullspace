export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export const ALLOWED_IMAGE_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

function startsWithBytes(bytes, signature) {
  return signature.every((value, index) => bytes[index] === value)
}

function hasImageSignature(mimeType, bytes) {
  switch (mimeType) {
    case 'image/jpeg':
      return startsWithBytes(bytes, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif':
      return startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38])
    case 'image/webp':
      return startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWithBytes(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
    default:
      return false
  }
}

export async function validateImageBlob(blob) {
  if (!blob || typeof blob.size !== 'number') {
    return { valid: false, reason: 'invalid' }
  }
  if (blob.size <= 0 || blob.size > MAX_IMAGE_SIZE) {
    return { valid: false, reason: blob.size > MAX_IMAGE_SIZE ? 'too-large' : 'invalid' }
  }

  const mimeType = typeof blob.type === 'string' ? blob.type.toLowerCase() : ''
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return { valid: false, reason: 'type' }
  }
  if (typeof blob.slice !== 'function') {
    return { valid: false, reason: 'invalid' }
  }

  try {
    const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
    return hasImageSignature(mimeType, header)
      ? { valid: true, mimeType }
      : { valid: false, reason: 'signature' }
  } catch {
    return { valid: false, reason: 'invalid' }
  }
}

export function imageExtensionForMime(mimeType) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }[mimeType] || null
}
