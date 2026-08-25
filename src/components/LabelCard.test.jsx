import { render, fireEvent } from '@solidjs/testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabelCard } from './LabelCard';

vi.mock('./CardContextMenu', () => ({
  CardContextMenu: (props) => (
    <div data-testid="mock-context-menu">
      <button data-testid="update-text" onClick={() => props.onTitleChange('New Title')}>Update Text</button>
      <button data-testid="minimize" onClick={() => props.onToggleMinimize()}>Minimize</button>
      <button data-testid="archive" onClick={() => props.onArchive()}>Archive</button>
      <button data-testid="delete" onClick={() => props.onDelete()}>Delete</button>
    </div>
  )
}));

describe('LabelCard', () => {
  const defaultLabel = {
    id: 'l1',
    text: 'Test Label',
    minimized: false,
    color: '#ff0000',
    fontSize: 12,
  };

  const defaultProps = {
    cardId: 'card-1',
    label: defaultLabel,
    labelTextColor: '#000000',
    onUpdateText: vi.fn(),
    onUpdateColor: vi.fn(),
    onUpdateFontSize: vi.fn(),
    onMoveCard: vi.fn(),
    onToggleMinimize: vi.fn(),
    onDuplicateCard: vi.fn(),
    onArchiveCard: vi.fn(),
    onDeleteCard: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText } = render(() => <LabelCard {...defaultProps} />);
    expect(getByText('Test Label')).toBeInTheDocument();
  });

  it('tests text update', () => {
    const { getByTestId } = render(() => <LabelCard {...defaultProps} />);
    fireEvent.click(getByTestId('update-text'));
    expect(defaultProps.onUpdateText).toHaveBeenCalledWith('l1', 'New Title');
  });

  it('tests minimize', () => {
    const { getByTestId } = render(() => <LabelCard {...defaultProps} />);
    fireEvent.click(getByTestId('minimize'));
    expect(defaultProps.onToggleMinimize).toHaveBeenCalledWith('l1');
  });

  it('tests archive', () => {
    const { getByTestId } = render(() => <LabelCard {...defaultProps} />);
    fireEvent.click(getByTestId('archive'));
    expect(defaultProps.onArchiveCard).toHaveBeenCalledWith('l1');
  });

  it('tests delete', () => {
    const { getByTestId } = render(() => <LabelCard {...defaultProps} />);
    fireEvent.click(getByTestId('delete'));
    expect(defaultProps.onDeleteCard).toHaveBeenCalledWith('l1');
  });
});
