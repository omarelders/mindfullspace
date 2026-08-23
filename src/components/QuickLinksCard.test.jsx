import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickLinksCard } from './QuickLinksCard'

describe('QuickLinksCard component', () => {
  const defaultCard = {
    id: 'ql-card-1',
    title: 'Resources',
    color: null,
    minimized: false,
    links: [
      { id: 'link-1', url: 'https://github.com', label: 'GitHub' },
      { id: 'link-2', url: 'javascript:alert(1)', label: 'Unsafe' },
    ],
  }

  const defaultProps = {
    quickLinkCard: defaultCard,
    position: { x: 50, y: 50 },
    onPointerDown: vi.fn(),
    onUpdateTitle: vi.fn(),
    onUpdateColor: vi.fn(),
    onMoveCard: vi.fn(),
    onToggleMinimize: vi.fn(),
    onDuplicateCard: vi.fn(),
    onArchiveCard: vi.fn(),
    onDeleteCard: vi.fn(),
    onAddLink: vi.fn(),
    onUpdateLink: vi.fn(),
    onRemoveLink: vi.fn(),
    onReorderLinks: vi.fn(),
    cardId: 'ql-card-1',
  }

  it('renders links and prevents dangerous schemes from becoming active links', () => {
    render(<QuickLinksCard {...defaultProps} />)

    const safeLink = screen.getByRole('link', { name: /github/i })
    expect(safeLink).toHaveAttribute('href', 'https://github.com/')

    // Unsafe link is neutralized to a span rather than an anchor
    expect(screen.queryByRole('link', { name: /unsafe/i })).not.toBeInTheDocument()
    expect(screen.getByText('Unsafe')).toBeInTheDocument()
  })

  it('adds a valid link via the form', () => {
    const onAddLink = vi.fn()
    const { container } = render(<QuickLinksCard {...defaultProps} onAddLink={onAddLink} />)

    const addBtn = screen.getByRole('button', { name: /add link/i })
    fireEvent.click(addBtn)

    const urlInput = screen.getByPlaceholderText(/url/i)
    const labelInput = screen.getByPlaceholderText(/label/i)

    fireEvent.change(urlInput, { target: { value: 'google.com' } })
    fireEvent.change(labelInput, { target: { value: 'Google' } })

    const form = container.querySelector('form.quick-links-form')
    fireEvent.submit(form)

    expect(onAddLink).toHaveBeenCalledWith(
      'ql-card-1',
      'https://google.com/',
      'Google'
    )
  })

  it('rejects adding a dangerous javascript scheme', () => {
    const onAddLink = vi.fn()
    const { container } = render(<QuickLinksCard {...defaultProps} onAddLink={onAddLink} />)

    fireEvent.click(screen.getByRole('button', { name: /add link/i }))
    const urlInput = screen.getByPlaceholderText(/url/i)

    fireEvent.change(urlInput, { target: { value: 'javascript:alert(1)' } })
    const form = container.querySelector('form.quick-links-form')
    fireEvent.submit(form)

    expect(onAddLink).not.toHaveBeenCalled()
  })
})
