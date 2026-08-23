// Single source of truth for the Chromium `zoom` CSS property capability.
// Evaluated once at module load; this app is client-only (no SSR), so the
// DOM is always available here.
export const supportsNativeZoom = 'zoom' in document.createElement('div').style
