// Collision-resistant id generator. Date.now() alone collides when multiple
// cards are created within the same millisecond (double-click, scripted
// import), which breaks React keys and cardPositions lookups. Two independent
// base36 random components give a keyspace far too large for realistic bursts.
export function createId(prefix = 'id') {
  const rand = () => Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now()}-${rand()}${rand()}`
}
