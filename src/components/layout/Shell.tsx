import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { OnboardingFlow } from '@/features/auth/components/OnboardingFlow';

const ONBOARDING_KEY = 'vesperant_onboarding_complete';

export function Shell() {
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === 'true'
  );

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboarded(true);
  };

  if (!onboarded) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg-base">
      <Header />
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="mx-auto max-w-lg px-4 py-6">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
