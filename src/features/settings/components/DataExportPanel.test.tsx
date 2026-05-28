import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataExportPanel } from './DataExportPanel';

// Mocks define the seams: services return canned data, downloadCsv captures
// what would have been written to disk so we can assert filename + header
// + per-button wiring without touching the browser download path.
const downloadCsvMock = vi.fn();
const csvFilenameMock = vi.fn((dataset: string) => `vesperant-${dataset}-2026-05-27.csv`);

vi.mock('@/lib/csv', async () => {
  const actual = await vi.importActual<typeof import('@/lib/csv')>('@/lib/csv');
  return {
    ...actual,
    downloadCsv: (...args: unknown[]) => downloadCsvMock(...args),
    csvFilename: (dataset: string) => csvFilenameMock(dataset),
  };
});

const getAllBottlesMock = vi.fn();
vi.mock('@/features/inventory/inventory.service', () => ({
  bottleService: { getAll: () => getAllBottlesMock() },
}));

const getAllRecipesMock = vi.fn();
vi.mock('@/features/recipes/recipes.service', () => ({
  recipeService: { getAllWithIngredients: () => getAllRecipesMock() },
}));

const getAllLogsMock = vi.fn();
vi.mock('@/features/cocktail-log/log.service', () => ({
  logService: { getAll: (userId: string) => getAllLogsMock(userId) },
}));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

describe('DataExportPanel', () => {
  beforeEach(() => {
    downloadCsvMock.mockReset();
    csvFilenameMock.mockClear();
    getAllBottlesMock.mockReset();
    getAllRecipesMock.mockReset();
    getAllLogsMock.mockReset();
  });

  it('renders one Export button per dataset', () => {
    render(<DataExportPanel />);
    expect(screen.getByText('Bottle inventory')).toBeInTheDocument();
    expect(screen.getByText('Recipe library')).toBeInTheDocument();
    expect(screen.getByText('Cocktail history')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Export CSV/i })).toHaveLength(3);
  });

  it('exports bottles with the bottle column header and a dated filename', async () => {
    getAllBottlesMock.mockResolvedValue([
      { name: 'Hendricks', brand: 'William Grant', category: 'gin', subcategory: null,
        spirit_type: null, tags: ['floral'], abv: 41.4, proof: 82.8, price_tier: 'standard',
        is_premium: false, active: true, notes: null, created_at: '2026-01-01T00:00:00Z' },
    ]);
    const user = userEvent.setup();
    render(<DataExportPanel />);

    await user.click(screen.getAllByRole('button', { name: /Export CSV/i })[0]);

    expect(getAllBottlesMock).toHaveBeenCalledTimes(1);
    expect(downloadCsvMock).toHaveBeenCalledTimes(1);
    const [filename, csv] = downloadCsvMock.mock.calls[0] as [string, string];
    expect(filename).toBe('vesperant-bottles-2026-05-27.csv');
    expect(csv).toMatch(/^name,brand,category/);
    expect(csv).toContain('Hendricks');
  });

  it('exports recipes with ingredients joined into a single cell', async () => {
    getAllRecipesMock.mockResolvedValue([
      {
        name: 'Negroni', aliases: [], slug: 'negroni', source: 'canonical',
        method: 'stir', glassware: 'rocks', garnish: 'Orange peel',
        tags: ['classic'], iba_category: 'Unforgettables',
        description: 'A balanced bitter aperitif.', history: null,
        recipe_ingredients: [
          { ingredient_name: 'Gin', quantity: 1, unit: 'oz', optional: false },
          { ingredient_name: 'Sweet Vermouth', quantity: 1, unit: 'oz', optional: false },
          { ingredient_name: 'Campari', quantity: 1, unit: 'oz', optional: false },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<DataExportPanel />);

    await user.click(screen.getAllByRole('button', { name: /Export CSV/i })[1]);

    expect(getAllRecipesMock).toHaveBeenCalledTimes(1);
    const [filename, csv] = downloadCsvMock.mock.calls[0] as [string, string];
    expect(filename).toBe('vesperant-recipes-2026-05-27.csv');
    // The ingredients column is joined and (because of the embedded commas in
    // the joined string would be ";"-separated, which doesn't need quoting)
    // appears as plain text.
    expect(csv).toContain('1 oz Gin; 1 oz Sweet Vermouth; 1 oz Campari');
  });

  it('exports history scoped to the current user', async () => {
    getAllLogsMock.mockResolvedValue([
      { logged_at: '2026-05-20T22:00:00Z', recipe_name: 'Negroni', rating: 5,
        tasting_notes: 'Citrus forward, bitter.', social_context: null,
        bottles_used: ['Tanqueray', 'Carpano Antica', 'Campari'] },
    ]);
    const user = userEvent.setup();
    render(<DataExportPanel />);

    await user.click(screen.getAllByRole('button', { name: /Export CSV/i })[2]);

    expect(getAllLogsMock).toHaveBeenCalledWith('user-123');
    const [filename, csv] = downloadCsvMock.mock.calls[0] as [string, string];
    expect(filename).toBe('vesperant-history-2026-05-27.csv');
    expect(csv).toMatch(/^logged_at,recipe_name,rating/);
    expect(csv).toContain('Negroni');
    expect(csv).toContain('Tanqueray; Carpano Antica; Campari');
  });

  it('surfaces an error message when the underlying query fails', async () => {
    getAllBottlesMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    render(<DataExportPanel />);

    await user.click(screen.getAllByRole('button', { name: /Export CSV/i })[0]);

    expect(await screen.findByText(/Export failed: network down/)).toBeInTheDocument();
    expect(downloadCsvMock).not.toHaveBeenCalled();
  });
});
