import { render, fireEvent, screen } from '@solidjs/testing-library'
import { describe, it, expect, vi } from 'vitest'
import { QuoteCard } from './QuoteCard'

describe('QuoteCard', () => {
  const baseQuote = {
    id: 'q1',
    title: 'Test Quote Card',
    text: 'To be or not to be',
    author: 'Shakespeare',
    minimized: false,
    fontSize: 20
  }

  it('renders quote text and author', () => {
    render(() => <QuoteCard quote={baseQuote} />)
    expect(screen.getByText('"To be or not to be"')).toBeInTheDocument()
    expect(screen.getByText('- Shakespeare')).toBeInTheDocument()
  })

  it('allows editing the quote text', () => {
    const onUpdateText = vi.fn()
    render(() => <QuoteCard quote={baseQuote} onUpdateText={onUpdateText} />)

    const textEl = screen.getByText('"To be or not to be"')
    fireEvent.click(textEl)

    const textarea = screen.getByPlaceholderText('Enter quote here...')
    expect(textarea).toBeInTheDocument()

    fireEvent.input(textarea, { target: { value: 'That is the question' } })
    fireEvent.blur(textarea)

    expect(onUpdateText).toHaveBeenCalledWith('q1', 'That is the question')
  })

  it('allows editing the quote author', () => {
    const onUpdateAuthor = vi.fn()
    render(() => <QuoteCard quote={baseQuote} onUpdateAuthor={onUpdateAuthor} />)

    const authorEl = screen.getByText('- Shakespeare')
    fireEvent.click(authorEl)

    const input = screen.getByPlaceholderText('Author name')
    expect(input).toBeInTheDocument()

    fireEvent.input(input, { target: { value: 'William Shakespeare' } })
    fireEvent.blur(input)

    expect(onUpdateAuthor).toHaveBeenCalledWith('q1', 'William Shakespeare')
  })
})
