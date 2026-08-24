import { createContext, useContext } from 'react'

/**
 * Wires the mobile column-layout card reordering into every card's context
 * menu without threading props through all twelve card components.
 *
 * WorkspaceBoard provides { canMove(cardId, direction), move(cardId, direction) }.
 * CardContextMenu resolves its own cardId via closest('[data-card-id]') and
 * consumes this context; when no provider is present reordering is omitted.
 */
export const MobileCardOrderContext = createContext(null)

export function MobileCardOrderProvider({ value, children }) {
  return (
    <MobileCardOrderContext.Provider value={value}>
      {children}
    </MobileCardOrderContext.Provider>
  )
}

export function useMobileCardOrderActions() {
  return useContext(MobileCardOrderContext)
}
