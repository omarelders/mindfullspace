const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'components', 'WorkspaceBoard.jsx');
let code = fs.readFileSync(file, 'utf8');

const targetStr = `{detachedLabels.map((label) => (
              <LabelCard
                key={label.id}
                cardId={label.id}
                label={label}
                labelTextColor={theme.labelText}
                position={cardPositions[label.id]}
                onPointerDown={actions.handleCardPointerDown}
                onUpdateText={actions.updateLabelText}
                onUpdateColor={actions.updateLabelColor}
                onUpdateFontSize={actions.updateLabelFontSize}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleLabelMinimize}
                onDuplicateCard={actions.duplicateLabelCard}
                onArchiveCard={actions.archiveLabelCard}
                onDeleteCard={actions.deleteLabelCard}
                isPopping={poppingCardIds.has(label.id)}
              />
            ))}`;

const singleNotesRender = `{detachedLabels.map((label) => (
              <LabelCard
                key={label.id}
                cardId={label.id}
                label={label}
                labelTextColor={theme.labelText}
                position={cardPositions[label.id]}
                onPointerDown={actions.handleCardPointerDown}
                onUpdateText={actions.updateLabelText}
                onUpdateColor={actions.updateLabelColor}
                onUpdateFontSize={actions.updateLabelFontSize}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleLabelMinimize}
                onDuplicateCard={actions.duplicateLabelCard}
                onArchiveCard={actions.archiveLabelCard}
                onDeleteCard={actions.deleteLabelCard}
                isPopping={poppingCardIds.has(label.id)}
              />
            ))}

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

// Normalize line endings to avoid mismatch
code = code.replace(/\r\n/g, '\n');
const targetStrNorm = targetStr.replace(/\r\n/g, '\n');

if (code.includes(targetStrNorm)) {
  code = code.replace(targetStrNorm, singleNotesRender);
  fs.writeFileSync(file, code);
  console.log('SUCCESS: WorkspaceBoard.jsx updated with singleNotes rendering!');
} else {
  console.log('FAILED: Target string not found in WorkspaceBoard.jsx');
}
