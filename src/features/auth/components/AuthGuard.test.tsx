import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from './AuthGuard';

const mockUseAuth = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// LoginScreen pulls useAuth via the same hook path; it'll get our mock too.
beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('AuthGuard', () => {
  it('shows the loading splash while the session is being resolved', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true });
    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>,
    );
    // Logo is shown during loading; child content is not.
    expect(screen.getAllByText('Vesperant').length).toBeGreaterThan(0);
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders the LoginScreen when there is no session', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false, signInWithGoogle: vi.fn() });
    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>,
    );
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children when a session exists', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1', email: 'a@b.com' } },
      loading: false,
    });
    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>,
    );
    expect(screen.getByText('protected content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign in with Google/i })).not.toBeInTheDocument();
  });
});
