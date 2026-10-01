import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyButton } from './CopyButton';

describe('CopyButton', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('copies the text from getText and confirms', async () => {
    // userEvent.setup() installs a clipboard stub on navigator.
    const user = userEvent.setup();
    const getText = vi.fn(() => 'NEGRONI\n\n1 oz Gin');
    render(<CopyButton label="Copy recipe" getText={getText} />);

    await user.click(screen.getByRole('button', { name: 'Copy recipe' }));

    expect(getText).toHaveBeenCalledTimes(1);
    await expect(navigator.clipboard.readText()).resolves.toBe('NEGRONI\n\n1 oz Gin');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('builds the text lazily, only on click', () => {
    const getText = vi.fn(() => 'x');
    render(<CopyButton label="Copy recipe" getText={getText} />);
    expect(getText).not.toHaveBeenCalled();
  });

  it('shows "Copy" in the text variant and swaps to "Copied"', async () => {
    const user = userEvent.setup();
    render(<CopyButton variant="text" label="Copy your build" getText={() => 'x'} />);
    const button = screen.getByRole('button', { name: 'Copy your build' });
    expect(button).toHaveTextContent('Copy');

    await user.click(button);
    expect(button).toHaveTextContent('Copied');
  });

  it('reverts to idle after two seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CopyButton variant="text" label="Copy" getText={() => 'x'} />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Copied');

    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole('button')).not.toHaveTextContent('Copied');
  });

  it('reports failure when the clipboard rejects', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    render(<CopyButton variant="text" label="Copy" getText={() => 'x'} />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent("Couldn't copy");
  });
});
