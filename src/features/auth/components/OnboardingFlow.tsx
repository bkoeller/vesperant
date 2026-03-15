import { useState } from 'react';
import { Wine, Key, MapPin, Sparkles, ArrowRight, Check, SkipForward } from 'lucide-react';
import { setClaudeApiKey, hasClaudeApiKey } from '@/lib/claude';
import { useBottles } from '@/features/inventory/hooks/useBottles';
import { useSeedInventory } from '@/features/inventory/hooks/useSeedInventory';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(hasClaudeApiKey());
  const { data: bottles } = useBottles();
  const seedInventory = useSeedInventory();

  const hasBottles = (bottles?.length ?? 0) > 0;

  const steps = [
    {
      icon: <Sparkles size={32} className="text-accent-gold" />,
      title: 'Welcome to Vesperant',
      subtitle: 'Your personal bar assistant — intelligent cocktail suggestions adapted to your bar, grounded in the moment.',
    },
    {
      icon: <Wine size={32} className="text-accent-copper" />,
      title: 'Set Up Your Bar',
      subtitle: 'Import your bottle collection to get started. You can always add or edit bottles later.',
    },
    {
      icon: <Key size={32} className="text-accent-gold" />,
      title: 'Claude API Key',
      subtitle: 'Vesperant uses Claude for intelligent suggestions. Enter your API key to enable the bartender brain.',
    },
    {
      icon: <MapPin size={32} className="text-info" />,
      title: 'You\'re All Set',
      subtitle: 'Your bar is ready. Ask Vesperant what you should make tonight.',
    },
  ];

  const current = steps[step];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg-base px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        {/* Step indicator */}
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 w-8 rounded-full transition-colors ${
                i <= step ? 'bg-accent-gold' : 'bg-bg-hover'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-surface">
          {current.icon}
        </div>

        {/* Text */}
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{current.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">{current.subtitle}</p>
        </div>

        {/* Step-specific content */}
        {step === 1 && (
          <div className="flex w-full flex-col gap-3">
            {hasBottles ? (
              <div className="flex items-center justify-center gap-2 rounded-button bg-success/10 py-3 text-sm text-success">
                <Check size={16} />
                {bottles?.length} bottles in your bar
              </div>
            ) : (
              <button
                onClick={() => seedInventory.mutate()}
                disabled={seedInventory.isPending}
                className="rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
              >
                {seedInventory.isPending ? 'Importing...' : 'Import Koeller Bar'}
              </button>
            )}
            {seedInventory.isError && (
              <p className="text-xs text-error">Import failed. Try again.</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex w-full flex-col gap-3">
            {keySaved ? (
              <div className="flex items-center justify-center gap-2 rounded-button bg-success/10 py-3 text-sm text-success">
                <Check size={16} />
                API key configured
              </div>
            ) : (
              <>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="rounded-button bg-bg-surface px-3 py-3 font-mono text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
                />
                <button
                  onClick={() => {
                    if (apiKey.trim()) {
                      setClaudeApiKey(apiKey.trim());
                      setKeySaved(true);
                    }
                  }}
                  disabled={!apiKey.trim()}
                  className="rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
                >
                  Save Key
                </button>
                <p className="text-xs text-text-tertiary">
                  Get your key from{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-accent-gold no-underline hover:text-accent-amber">
                    console.anthropic.com
                  </a>
                </p>
              </>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex w-full gap-3">
          {step < steps.length - 1 ? (
            <>
              {step > 0 && step < 3 && (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex-1 rounded-button bg-bg-surface py-3 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <SkipForward size={14} />
                    Skip
                  </span>
                </button>
              )}
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-1 rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber"
              >
                <span className="flex items-center justify-center gap-1.5">
                  {step === 0 ? 'Get Started' : 'Next'}
                  <ArrowRight size={14} />
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={onComplete}
              className="flex-1 rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Sparkles size={14} />
                What should I make tonight?
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
