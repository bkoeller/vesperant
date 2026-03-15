import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoginScreen } from './LoginScreen';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-4">
          <h1 className="font-serif text-3xl font-semibold text-text-primary">
            Vesperant
          </h1>
          <div className="h-1 w-16 animate-pulse rounded-full bg-accent-gold-dim" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
