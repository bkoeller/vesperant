import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuggestionCard } from './SuggestionCard';
import type { SuggestionResult } from '@/lib/claude';

// The card now reads the recipe library via useRecipes to know whether to
// render the title as a link. Wrap renders in a QueryClientProvider so the
// hook doesn't blow up; the actual fetch is irrelevant — `data` stays
// undefined and the lookup returns null, so the title falls back to text.
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeSuggestion(overrides: Partial<SuggestionResult> = {}): SuggestionResult {
  return {
    archetype: 'safe',
    recipe_name: 'Negroni',
    recipe_slug: 'negroni',
    reasoning: 'A perfectly balanced bitter aperitif.',
    adapted_recipe: {
      ingredients: [
        { ingredient_name: 'Gin', bottle_from_inventory: 'Hendricks', quantity: '1', unit: 'oz', notes: null },
        { ingredient_name: 'Sweet Vermouth', bottle_from_inventory: null, quantity: '1', unit: 'oz', notes: null },
        { ingredient_name: 'Campari', bottle_from_inventory: 'Campari', quantity: '1', unit: 'oz', notes: null },
      ],
      method: 'Stir with ice and strain over a large cube.',
      glassware: 'rocks',
      garnish: 'Orange peel',
      proof_warning: null,
      value_notes: null,
      variation_notes: null,
    },
    missing_ingredients: [],
    ...overrides,
  };
}

describe('SuggestionCard', () => {
  it('renders the recipe name and reasoning', () => {
    render(<SuggestionCard suggestion={makeSuggestion()} onMakeThis={() => {}} />);
    expect(screen.getByText('Negroni')).toBeInTheDocument();
    expect(screen.getByText(/perfectly balanced/)).toBeInTheDocument();
  });

  it.each([
    ['safe', 'Safe Choice'],
    ['adventurous', 'Adventurous'],
    ['cultural', 'Cultural'],
  ] as const)('shows the right archetype label for %s', (archetype, expected) => {
    render(
      <SuggestionCard
        suggestion={makeSuggestion({ archetype })}
        onMakeThis={() => {}}
      />,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('hides recipe details by default and reveals them on click', async () => {
    const user = userEvent.setup();
    render(<SuggestionCard suggestion={makeSuggestion()} onMakeThis={() => {}} />);

    expect(screen.queryByText(/Stir with ice/)).not.toBeInTheDocument();
    await user.click(screen.getByText('Show recipe'));
    expect(screen.getByText(/Stir with ice/)).toBeInTheDocument();
    expect(screen.getByText('Garnish: Orange peel')).toBeInTheDocument();
  });

  it('uses bottle_from_inventory in place of generic ingredient when available', async () => {
    const user = userEvent.setup();
    render(<SuggestionCard suggestion={makeSuggestion()} onMakeThis={() => {}} />);
    await user.click(screen.getByText('Show recipe'));

    // "Hendricks" replaces "Gin"; "Sweet Vermouth" stays generic (no bottle).
    expect(screen.getByText('Hendricks')).toBeInTheDocument();
    expect(screen.getByText('Sweet Vermouth')).toBeInTheDocument();
    expect(screen.queryByText('Gin')).not.toBeInTheDocument();
  });

  it('displays a missing-ingredients warning when there are gaps', () => {
    render(
      <SuggestionCard
        suggestion={makeSuggestion({ missing_ingredients: ['Orgeat'] })}
        onMakeThis={() => {}}
      />,
    );
    expect(screen.getByText(/Missing: Orgeat/)).toBeInTheDocument();
  });

  it('omits the missing-ingredients warning when nothing is missing', () => {
    render(<SuggestionCard suggestion={makeSuggestion()} onMakeThis={() => {}} />);
    expect(screen.queryByText(/Missing:/)).not.toBeInTheDocument();
  });

  it('shows a proof warning when present', async () => {
    const user = userEvent.setup();
    const warning = 'Cask strength — reduce base by 25%';
    const base = makeSuggestion();
    render(
      <SuggestionCard
        suggestion={makeSuggestion({
          adapted_recipe: { ...base.adapted_recipe!, proof_warning: warning },
        })}
        onMakeThis={() => {}}
      />,
    );
    await user.click(screen.getByText('Show recipe'));
    expect(screen.getByText(warning)).toBeInTheDocument();
  });

  it('fires onMakeThis with the suggestion when "Make this" is clicked', async () => {
    const user = userEvent.setup();
    const onMakeThis = vi.fn();
    const suggestion = makeSuggestion();
    render(<SuggestionCard suggestion={suggestion} onMakeThis={onMakeThis} />);

    await user.click(screen.getByRole('button', { name: 'Make this' }));
    expect(onMakeThis).toHaveBeenCalledTimes(1);
    expect(onMakeThis).toHaveBeenCalledWith(suggestion);
  });
});
