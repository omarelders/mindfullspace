import { useEffect, useState } from 'react'

const COLUMN_LAYOUT_QUERY = '(max-width: 1200px)'

/**
 * True while the viewport is inside the app's single-column mobile/tablet
 * breakpoint (<= 1200px, matching the CSS). SSR/jsdom safe.
 */
export function useIsColumnLayout() {
  const [isColumnLayout, setIsColumnLayout] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(COLUMN_LAYOUT_QUERY).matches
  ))

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(COLUMN_LAYOUT_QUERY)
    const update = () => setIsColumnLayout(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isColumnLayout
}
