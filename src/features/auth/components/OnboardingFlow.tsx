import { useState } from 'react';
import { Wine, Sparkles, ArrowRight, Check, SkipForward } from 'lucide-react';
import { useBottles } from '@/features/inventory/hooks/useBottles';
import { useSeedInventory } from '@/features/inventory/hooks/useSeedInventory';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const { user } = useAuth();
  const { data: bottles } = useBottles();
  const seedInventory = useSeedInventory();

  // The seed-data import is owner-only ("Koeller Bar"). Other users get the
  // generic empty-bar flow and can use photo/list import after onboarding.
  const isOwner = user?.email?.toLowerCase() === 'bkoeller@gmail.com';
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
      subtitle: 'Add a few bottles to get started. You can always add more or import from a photo later.',
    },
    {
      icon: <Sparkles size={32} className="text-accent-gold" />,
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
            ) : isOwner ? (
              <button
                onClick={() => seedInventory.mutate()}
                disabled={seedInventory.isPending}
                className="rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
              >
                {seedInventory.isPending ? 'Importing...' : 'Import Koeller Bar'}
              </button>
            ) : (
              <p className="text-xs text-text-tertiary">
                Tap "Skip" for now — you can add bottles from the Inventory tab using the camera or list import.
              </p>
            )}
            {seedInventory.isError && (
              <p className="text-xs text-error">Import failed. Try again.</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex w-full gap-3">
          {step < steps.length - 1 ? (
            <>
              {step > 0 && step < steps.length - 1 && (
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
