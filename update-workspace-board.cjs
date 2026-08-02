const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'components', 'WorkspaceBoard.jsx');
let code = fs.readFileSync(file, 'utf8');

// Import SingleNoteCard
code = code.replace(
  /import \{ LabelCard \} from '\.\/LabelCard'/,
  `import { LabelCard } from './LabelCard'\nimport { SingleNoteCard } from './SingleNoteCard'`
);

// Add singleNotes to state destructuring
code = code.replace(
  /archivedCards, detachedLabels, cardPositions,/,
  `archivedCards, detachedLabels, singleNotes, cardPositions,`
);

// Map over singleNotes to render them
const singleNotesRender = `
            {singleNotes.map((note) => (
              <SingleNoteCard
                key={note.id}
                cardId={note.id}
                singleNote={note}
                position={cardPositions[note.id]}
                textColor="var(--label-text)"
                onPointerDown={actions.handleCardPointerDown}
                onUpdateText={actions.updateSingleNoteText}
                onUpdateColor={actions.updateSingleNoteColor}
                onUpdateFontSize={actions.updateSingleNoteFontSize}
                onUpdateShape={actions.updateSingleNoteShape}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleSingleNoteMinimize}
                onDuplicateCard={actions.duplicateSingleNoteCard}
                onArchiveCard={actions.archiveSingleNoteCard}
                onDeleteCard={actions.deleteSingleNoteCard}
                isPopping={poppingCardIds.has(note.id)}
              />
            ))}`;

code = code.replace(
  /\{\s*detachedLabels\.map\(\(label\) => \([\s\S]*?\}\)\)/,
  `$&${singleNotesRender}`
);

fs.writeFileSync(file, code);
console.log('WorkspaceBoard updated');
