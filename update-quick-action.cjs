const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'hooks', 'useWorkspace.js');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /if \(actionId === 'label'\) handleAddLabel\(pos\)\s*else if \(actionId === 'note'\)/,
  `if (actionId === 'label') handleAddLabel(pos)\n    else if (actionId === 'singlenote') handleAddSingleNote(pos)\n    else if (actionId === 'note')`
);

fs.writeFileSync(file, code);
console.log('useWorkspace.js updated for quick action');
