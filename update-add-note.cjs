const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'hooks', 'useWorkspace.js');
let code = fs.readFileSync(file, 'utf8');

const targetStr = `  const handleAddLabel = useCallback((pos) => {
    const id = \`label-\${Date.now()}\`; const roles = ['routine', 'programming', 'english']
    setCustomLabels(p => [...p, { id, text: '', role: roles[Math.floor(Math.random() * roles.length)] }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 400 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport, setCustomLabels])`;

const replacement = `  const handleAddLabel = useCallback((pos) => {
    const id = \`label-\${Date.now()}\`; const roles = ['routine', 'programming', 'english']
    setCustomLabels(p => [...p, { id, text: '', role: roles[Math.floor(Math.random() * roles.length)] }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 400 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport, setCustomLabels])

  const handleAddSingleNote = useCallback((pos) => {
    const id = \`singlenote-\${Date.now()}\`
    singleNoteCol.add({ id, text: 'Single Note', shape: 'rectangle' })
    setCardPositions(p => ({ ...p, [id]: pos || { x: 450 - (viewport.x / viewport.scale), y: 350 - (viewport.y / viewport.scale) } }))
  }, [viewport, setCardPositions, singleNoteCol])`;

code = code.replace(targetStr, replacement);
fs.writeFileSync(file, code);
console.log('useWorkspace.js updated with handleAddSingleNote');
