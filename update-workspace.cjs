const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'hooks', 'useWorkspace.js');
let code = fs.readFileSync(file, 'utf8');

// 1. Add singleNoteCol
code = code.replace(
  /const labelCol = useCardCollection\(\{\s*initialItems: initialWorkspaceState\.customLabels,[\s\S]*?onDuplicate: \(source, dupData\) => \(\{ \.\.\.source, id: dupData\.id \}\)\s*\}\)/,
  `$&

  const singleNoteCol = useCardCollection({
    initialItems: initialWorkspaceState.singleNotes,
    idPrefix: 'singlenote',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
    onDuplicate: (source, dupData) => ({ ...source, id: dupData.id })
  })`
);

// 2. Add aliases
code = code.replace(
  /const customLabels = labelCol\.items\s*const setCustomLabels = labelCol\.setItems/,
  `$&
  const singleNotes = singleNoteCol.items
  const setSingleNotes = singleNoteCol.setItems`
);

// 3. stateRefsForSnapshot
code = code.replace(
  /customLabels,\s*cardPositions/g,
  `customLabels, singleNotes, cardPositions`
);

// 4. captureSnapshot
code = code.replace(
  /customLabels:\s*s\.customLabels,/,
  `$&
      singleNotes: s.singleNotes,`
);

// 5. load snapshot
code = code.replace(
  /setCustomLabels\(snapshot\.customLabels\)/,
  `$&
    if (snapshot.singleNotes) setSingleNotes(snapshot.singleNotes)`
);
code = code.replace(
  /setCustomLabels,\s*setCardPositions/,
  `setCustomLabels, setSingleNotes, setCardPositions`
);

// 6. renderedCardIds
code = code.replace(
  /\.\.\.detachedLabels\.map\(\(label\) => label\.id\),/,
  `$&
      ...singleNotes.map((note) => note.id),`
);
code = code.replace(
  /detachedLabels,\s*notes,/,
  `detachedLabels, singleNotes, notes,`
);

// 7. handleAddSingleNote
code = code.replace(
  /const handleAddLabel = useCallback\(\(\) => \{[\s\S]*?\}, \[labelCol, saveSnapshot, setCardPositions, viewport\]\)/,
  `$&

  const handleAddSingleNote = useCallback(() => {
    const id = \`singlenote-\${Date.now()}\`
    const vx = viewport.x / viewport.scale; const vy = viewport.y / viewport.scale
    setCardPositions((prev) => ({ ...prev, [id]: { x: 450 - vx, y: 350 - vy } }))
    singleNoteCol.add({ id, text: 'Single Note', shape: 'rectangle' })
    saveSnapshot()
  }, [singleNoteCol, saveSnapshot, setCardPositions, viewport])`
);

// add to dependency array of double-click to add
code = code.replace(
  /handleAddQuote\]\)/,
  `handleAddQuote, handleAddSingleNote])`
);
code = code.replace(
  /handleAddQuote,\s*cardPositions/,
  `handleAddQuote, handleAddSingleNote, cardPositions`
);

// restoreArchivedCard
code = code.replace(
  /restoredCardId = \`label-\$\{uniqueSeed\}\`\s*setCustomLabels\(current => \[\.\.\.current, \{ \.\.\.archivedData, id: restoredCardId, text: archivedData\.text \|\| 'LABEL', role: archivedData\.role \|\| 'routine' \}\]\)\s*\}/,
  `$& else if (archivedEntry.type === 'singlenote') {
      restoredCardId = \`singlenote-\${uniqueSeed}\`
      setSingleNotes(current => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || 'Single Note' }])
    }`
);

// 8. Actions
code = code.replace(
  /const deleteLabelCard = labelCol\.remove/,
  `$&

  // Single Notes
  const updateSingleNoteText = useCallback((id, text) => singleNoteCol.update(id, { text }), [singleNoteCol])
  const updateSingleNoteColor = useCallback((id, color) => singleNoteCol.update(id, { color }), [singleNoteCol])
  const updateSingleNoteFontSize = useCallback((id, fontSize) => singleNoteCol.update(id, { fontSize }), [singleNoteCol])
  const updateSingleNoteShape = useCallback((id, shape) => singleNoteCol.update(id, { shape }), [singleNoteCol])
  const toggleSingleNoteMinimize = singleNoteCol.toggleMinimize
  const duplicateSingleNoteCard = singleNoteCol.duplicate
  const archiveSingleNoteCard = singleNoteCol.archive
  const deleteSingleNoteCard = singleNoteCol.remove`
);

// 9. Returned actions
code = code.replace(
  /duplicateLabelCard,\s*archiveLabelCard,\s*deleteLabelCard,/,
  `$&
      updateSingleNoteText, updateSingleNoteColor, updateSingleNoteFontSize, updateSingleNoteShape, toggleSingleNoteMinimize, duplicateSingleNoteCard, archiveSingleNoteCard, deleteSingleNoteCard,`
);

// Add to returned vars
code = code.replace(
  /customLabels,\s*detachedLabels,\s*labels:\s*customLabels,/,
  `$& singleNotes,`
);

// Add to alias quicklinks/quotes etc
code = code.replace(
  /handleAddLabel,/,
  `$& handleAddSingleNote,`
);


fs.writeFileSync(file, code);
console.log('useWorkspace.js updated');
