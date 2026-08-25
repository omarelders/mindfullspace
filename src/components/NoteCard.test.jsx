import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { NoteCard } from './NoteCard'

describe('NoteCard font size controls inside dropdown menu', () => {
  const defaultNote = () => ({
    id: 'note-1',
    title: 'Test Note',
    text: 'Hello world',
    minimized: false,
    fontSize: 14,
  })

  it('renders font size controls inside 3 dots menu and updates font size when clicked', () => {
    const onUpdateFontSize = vi.fn()
    render(() => (
      <NoteCard
        note={defaultNote()}
        cardId="note-1"
        onUpdateFontSize={onUpdateFontSize}
      />
    ))

    // Open 3 dots menu
    const menuBtn = screen.getByRole('button', { name: 'card menu' })
    fireEvent.click(menuBtn)

    const decBtn = screen.getByRole('button', { name: 'Decrease font size' })
    const incBtn = screen.getByRole('button', { name: 'Increase font size' })
    expect(screen.getByText('14px')).toBeInTheDocument()

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
    render(() => <NoteCard note={{ ...defaultNote(), fontSize: 10 }} cardId="note-1" />)

    // Open 3 dots menu
    fireEvent.click(screen.getByRole('button', { name: 'card menu' }))

    const decBtn = screen.getByRole('button', { name: 'Decrease font size' })
    expect(decBtn).toBeDisabled()
  })

  it('disables increase button at maximum font size (48px)', () => {
    render(() => <NoteCard note={{ ...defaultNote(), fontSize: 48 }} cardId="note-1" />)

    // Open 3 dots menu
    fireEvent.click(screen.getByRole('button', { name: 'card menu' }))

    const incBtn = screen.getByRole('button', { name: 'Increase font size' })
    expect(incBtn).toBeDisabled()
  })

  it('renders font size controls in menu even when card is minimized', () => {
    render(() => <NoteCard note={{ ...defaultNote(), minimized: true }} cardId="note-1" />)

    // Open 3 dots menu
    fireEvent.click(screen.getByRole('button', { name: 'card menu' }))

    expect(screen.getByRole('button', { name: 'Decrease font size' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase font size' })).toBeInTheDocument()
  })
})
