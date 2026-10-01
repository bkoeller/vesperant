import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

type CopyState = 'idle' | 'copied' | 'error';

interface CopyButtonProps {
  /** Built lazily on click so callers don't format text on every render. */
  getText: () => string;
  /** Accessible name, and the visible label for the text variant. */
  label: string;
  /** `icon`: square icon button for headers. `text`: small inline text button. */
  variant?: 'icon' | 'text';
}

const RESET_MS = 2000;

export function CopyButton({ getText, label, variant = 'icon' }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(getText());
      setState('copied');
    } catch {
      setState('error');
    }
    timer.current = setTimeout(() => setState('idle'), RESET_MS);
  };

  const status = state === 'copied' ? 'Copied' : state === 'error' ? "Couldn't copy" : '';
  const Icon = state === 'copied' ? Check : Copy;

  if (variant === 'text') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
          state === 'error' ? 'text-error' : state === 'copied' ? 'text-accent-gold' : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        <Icon size={14} />
        <span aria-live="polite">{status || 'Copy'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={status || label}
      className={`relative rounded-button p-2 transition-colors hover:bg-bg-hover ${
        state === 'error' ? 'text-error' : state === 'copied' ? 'text-accent-gold' : 'text-text-tertiary hover:text-text-primary'
      }`}
    >
      <Icon size={16} />
      <span aria-live="polite" className="sr-only">{status}</span>
    </button>
  );
}
