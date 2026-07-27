import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NoteCard } from './NoteCard'

describe('NoteCard font size controls', () => {
  const defaultNote = {
    id: 'note-1',
    title: 'Test Note',
    text: 'Hello world',
    minimized: false,
    fontSize: 14,
  }

  it('renders font size controls and updates font size when clicked', () => {
    const onUpdateFontSize = vi.fn()
    render(
      <NoteCard
        note={defaultNote}
        cardId={defaultNote.id}
        onUpdateFontSize={onUpdateFontSize}
      />
    )

    const decBtn = screen.getByRole('button', { name: 'Decrease font size' })
    const incBtn = screen.getByRole('button', { name: 'Increase font size' })

    expect(decBtn).toBeInTheDocument()
    expect(incBtn).toBeInTheDocument()

    // Test increase
    fireEvent.click(incBtn)
    expect(onUpdateFontSize).toHaveBeenCalledWith('note-1', 16)

    // Test decrease
    fireEvent.click(decBtn)
    expect(onUpdateFontSize).toHaveBeenCalledWith('note-1', 12)
  })

  it('disables decrease button at minimum font size (10px)', () => {
    const minNote = { ...defaultNote, fontSize: 10 }
    render(<NoteCard note={minNote} cardId={minNote.id} />)

    const decBtn = screen.getByRole('button', { name: 'Decrease font size' })
    expect(decBtn).toBeDisabled()
  })

  it('disables increase button at maximum font size (48px)', () => {
    const maxNote = { ...defaultNote, fontSize: 48 }
    render(<NoteCard note={maxNote} cardId={maxNote.id} />)

    const incBtn = screen.getByRole('button', { name: 'Increase font size' })
    expect(incBtn).toBeDisabled()
  })

  it('hides font size controls when card is minimized', () => {
    const minCard = { ...defaultNote, minimized: true }
    render(<NoteCard note={minCard} cardId={minCard.id} />)

    expect(screen.queryByRole('button', { name: 'Decrease font size' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Increase font size' })).not.toBeInTheDocument()
  })
})
