import { useEffect, useRef, useState } from 'react'

/**
 * Lazily mounts heavy card subtrees on the mobile column layout.
 *
 * Children render only once they come near the viewport (rootMargin covers a
 * couple of screens ahead). Mounting is monotonic — once shown, a card stays
 * mounted — so scrolling never tears down state (running timers, drafts) and
 * never causes layout jump-back. On desktop (or without IntersectionObserver,
 * e.g. jsdom) children always render.
 */
export function LazyMount({ isDeferred, children }) {
  const ref = useRef(null)
  const [shouldMount, setShouldMount] = useState(!isDeferred)

  useEffect(() => {
    // Promote immediately when deferment switches off (viewport grew).
    if (!isDeferred) {
      setShouldMount(true)
      return undefined
    }
    if (shouldMount) return undefined
    if (typeof IntersectionObserver !== 'function') {
      setShouldMount(true)
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldMount(true)
        observer.disconnect()
      }
    }, { rootMargin: '150% 0px' })

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [isDeferred, shouldMount])

  if (shouldMount) {
    return <>{children}</>
  }
  return <div ref={ref} data-lazy-slot="pending" style={{ minHeight: 40 }} aria-hidden="true" />
}
