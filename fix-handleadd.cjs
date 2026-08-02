const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'hooks', 'useWorkspace.js');
let code = fs.readFileSync(file, 'utf8');

// Match handleAddLabel precisely and capture it
const regex = /(const handleAddLabel = useCallback\(\(pos\) => \{[\s\S]*?\}, \[viewport, setCustomLabels\]\))/;

if (regex.test(code)) {
  const replacement = `$1

  const handleAddSingleNote = useCallback((pos) => {
    const id = \`singlenote-\${Date.now()}\`
    const vx = viewport.x / viewport.scale; const vy = viewport.y / viewport.scale
    setCardPositions((prev) => ({ ...prev, [id]: pos || { x: 450 - vx, y: 350 - vy } }))
    singleNoteCol.add({ id, text: 'Single Note', shape: 'rectangle' })
    saveSnapshot()
  }, [singleNoteCol, saveSnapshot, setCardPositions, viewport])`;

  code = code.replace(regex, replacement);
  fs.writeFileSync(file, code);
  console.log('SUCCESS');
} else {
  console.log('FAILED TO MATCH');
}
