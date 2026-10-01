import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { RecipeWithIngredients } from '../recipes.service';
import { RecipeFormPage } from './RecipeFormPage';

// Seams: the recipe query and mutations are mocked at the hook level, the
// router is reduced to a navigate spy + plain <a>, and auth returns a fixed
// user. Each test sets `recipeQuery` to drive loading / loaded / refetch.
let recipeQuery: { data: RecipeWithIngredients | undefined; isLoading: boolean };
const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const navigateMock = vi.fn();
let routeParams: { slug?: string } = {};

vi.mock('../hooks/useRecipes', () => ({
  useRecipeBySlug: () => recipeQuery,
  useCreateRecipe: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateRecipe: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigateMock,
  useParams: () => routeParams,
}));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

function makeRecipe(overrides: Partial<RecipeWithIngredients> = {}): RecipeWithIngredients {
  return {
    id: 'recipe-1',
    user_id: 'user-123',
    name: 'Penicillin',
    aliases: ['Penny', 'Smoky Lemon'],
    slug: 'penicillin',
    description: 'Smoky, spicy, sour.',
    history: 'Sam Ross, Milk & Honey, 2005.',
    method: 'shake',
    glassware: 'Rocks',
    garnish: 'Candied ginger',
    tags: ['modern', 'scotch', 'house-favorite'],
    iba_category: null,
    source: 'user',
    created_at: '2026-01-01T00:00:00Z',
    recipe_ingredients: [
      { id: 'ing-1', recipe_id: 'recipe-1', ingredient_name: 'Blended Scotch', ingredient_category: 'whisky',
        quantity: 2, unit: 'oz', role: 'base', optional: false, sort_order: 0, notes: null },
      { id: 'ing-2', recipe_id: 'recipe-1', ingredient_name: 'Lemon juice', ingredient_category: 'mixer',
        quantity: 0.75, unit: 'oz', role: 'sour', optional: false, sort_order: 1, notes: 'fresh-squeezed' },
    ],
    ...overrides,
  };
}

const ingredientNames = () =>
  screen.getAllByPlaceholderText(/Ingredient name/).map(el => (el as HTMLInputElement).value);

describe('RecipeFormPage', () => {
  beforeEach(() => {
    createMutateAsync.mockReset();
    updateMutateAsync.mockReset();
    navigateMock.mockReset();
    recipeQuery = { data: undefined, isLoading: false };
    routeParams = {};
  });

  describe('new mode', () => {
    it('starts empty with one ingredient row and Create disabled', () => {
      render(<RecipeFormPage mode="new" />);
      expect(screen.getByRole('heading', { name: 'New Recipe' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Penicillin')).toHaveValue('');
      expect(ingredientNames()).toEqual(['']);
      expect(screen.getByRole('button', { name: 'Create Recipe' })).toBeDisabled();
    });

    it('requires both a name and an ingredient before enabling Create', async () => {
      const user = userEvent.setup();
      render(<RecipeFormPage mode="new" />);
      const create = screen.getByRole('button', { name: 'Create Recipe' });

      await user.type(screen.getByPlaceholderText('e.g. Penicillin'), 'Gold Rush');
      expect(create).toBeDisabled();
      await user.type(screen.getByPlaceholderText(/Ingredient name/), 'Bourbon');
      expect(create).toBeEnabled();
    });

    it('submits trimmed fields, merged tags, and non-empty ingredients, then navigates', async () => {
      createMutateAsync.mockResolvedValue({ slug: 'gold-rush' });
      const user = userEvent.setup();
      render(<RecipeFormPage mode="new" />);

      await user.type(screen.getByPlaceholderText('e.g. Penicillin'), '  Gold Rush  ');
      await user.type(screen.getByPlaceholderText(/Smoky Lemon/), 'GR, ');
      await user.click(screen.getByRole('button', { name: 'Sour' }));
      await user.type(screen.getByPlaceholderText(/Custom tags/), 'honey, sour');
      await user.type(screen.getByPlaceholderText(/Ingredient name/), ' Bourbon ');
      await user.click(screen.getByRole('button', { name: /Add/ }));
      // Second row left blank — it must be dropped from the payload.

      await user.click(screen.getByRole('button', { name: 'Create Recipe' }));

      expect(createMutateAsync).toHaveBeenCalledTimes(1);
      const { input, ingredients } = createMutateAsync.mock.calls[0][0];
      expect(input).toMatchObject({
        name: 'Gold Rush',
        aliases: ['GR'],
        description: null,
        method: 'stir',
        tags: ['sour', 'honey'],
      });
      expect(ingredients).toHaveLength(1);
      expect(ingredients[0]).toMatchObject({ ingredient_name: 'Bourbon', unit: 'oz', role: 'base' });
      expect(navigateMock).toHaveBeenCalledWith({ to: '/recipes/$slug', params: { slug: 'gold-rush' } });
    });

    it('shows the error and stays on the page when the save fails', async () => {
      createMutateAsync.mockRejectedValue(new Error('duplicate slug'));
      const user = userEvent.setup();
      render(<RecipeFormPage mode="new" />);

      await user.type(screen.getByPlaceholderText('e.g. Penicillin'), 'Negroni');
      await user.type(screen.getByPlaceholderText(/Ingredient name/), 'Gin');
      await user.click(screen.getByRole('button', { name: 'Create Recipe' }));

      expect(await screen.findByText('duplicate slug')).toBeInTheDocument();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    beforeEach(() => {
      routeParams = { slug: 'penicillin' };
    });

    it('shows the loading state instead of an empty form while the recipe loads', () => {
      recipeQuery = { data: undefined, isLoading: true };
      render(<RecipeFormPage mode="edit" />);
      expect(screen.queryByRole('heading', { name: 'Edit Recipe' })).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('e.g. Penicillin')).not.toBeInTheDocument();
    });

    it('fills every field from the loaded recipe', () => {
      recipeQuery = { data: makeRecipe(), isLoading: false };
      render(<RecipeFormPage mode="edit" />);

      expect(screen.getByRole('heading', { name: 'Edit Recipe' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Penicillin')).toHaveValue('Penicillin');
      expect(screen.getByPlaceholderText(/Smoky Lemon/)).toHaveValue('Penny, Smoky Lemon');
      expect(screen.getByPlaceholderText(/One or two sentences/)).toHaveValue('Smoky, spicy, sour.');
      expect(screen.getByPlaceholderText('e.g. Coupe')).toHaveValue('Rocks');
      expect(screen.getByPlaceholderText(/Candied ginger and lemon/)).toHaveValue('Candied ginger');
      expect(screen.getByPlaceholderText(/Origin, lore/)).toHaveValue('Sam Ross, Milk & Honey, 2005.');
      expect(screen.getByDisplayValue('Shaken')).toBeInTheDocument();

      // Known tags become selected chips; unknown ones land in the custom field.
      expect(screen.getByRole('button', { name: 'Modern' })).toHaveClass('bg-accent-gold');
      expect(screen.getByRole('button', { name: 'Scotch' })).toHaveClass('bg-accent-gold');
      expect(screen.getByRole('button', { name: 'Tiki' })).not.toHaveClass('bg-accent-gold');
      expect(screen.getByPlaceholderText(/Custom tags/)).toHaveValue('house-favorite');

      expect(ingredientNames()).toEqual(['Blended Scotch', 'Lemon juice']);
      expect(screen.getByDisplayValue('fresh-squeezed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    });

    it('fills the form when the recipe arrives after the loading state', () => {
      recipeQuery = { data: undefined, isLoading: true };
      const { rerender } = render(<RecipeFormPage mode="edit" />);

      recipeQuery = { data: makeRecipe(), isLoading: false };
      rerender(<RecipeFormPage mode="edit" />);

      expect(screen.getByPlaceholderText('e.g. Penicillin')).toHaveValue('Penicillin');
      expect(ingredientNames()).toEqual(['Blended Scotch', 'Lemon juice']);
    });

    it('keeps in-progress edits when a background refetch returns a new object', async () => {
      recipeQuery = { data: makeRecipe(), isLoading: false };
      const user = userEvent.setup();
      const { rerender } = render(<RecipeFormPage mode="edit" />);

      const nameInput = screen.getByPlaceholderText('e.g. Penicillin');
      await user.clear(nameInput);
      await user.type(nameInput, 'Penicillin No. 2');

      recipeQuery = { data: makeRecipe(), isLoading: false };
      rerender(<RecipeFormPage mode="edit" />);

      expect(screen.getByPlaceholderText('e.g. Penicillin')).toHaveValue('Penicillin No. 2');
    });

    it('saves edits against the recipe id and navigates to the updated slug', async () => {
      recipeQuery = { data: makeRecipe(), isLoading: false };
      updateMutateAsync.mockResolvedValue({ slug: 'penicillin-no-2' });
      const user = userEvent.setup();
      render(<RecipeFormPage mode="edit" />);

      const nameInput = screen.getByPlaceholderText('e.g. Penicillin');
      await user.clear(nameInput);
      await user.type(nameInput, 'Penicillin No. 2');
      await user.click(screen.getAllByRole('button', { name: 'Remove ingredient' })[1]);
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(createMutateAsync).not.toHaveBeenCalled();
      expect(updateMutateAsync).toHaveBeenCalledTimes(1);
      const { id, input, ingredients } = updateMutateAsync.mock.calls[0][0];
      expect(id).toBe('recipe-1');
      expect(input).toMatchObject({
        name: 'Penicillin No. 2',
        aliases: ['Penny', 'Smoky Lemon'],
        method: 'shake',
        tags: ['modern', 'scotch', 'house-favorite'],
      });
      expect(ingredients.map((i: { ingredient_name: string }) => i.ingredient_name)).toEqual(['Blended Scotch']);
      expect(navigateMock).toHaveBeenCalledWith({ to: '/recipes/$slug', params: { slug: 'penicillin-no-2' } });
    });

    it("blocks editing someone else's recipe", () => {
      recipeQuery = { data: makeRecipe({ user_id: 'someone-else' }), isLoading: false };
      render(<RecipeFormPage mode="edit" />);
      expect(screen.getByText('You can only edit your own recipes.')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('e.g. Penicillin')).not.toBeInTheDocument();
    });

    it('blocks editing canonical recipes, which have no owner', () => {
      recipeQuery = { data: makeRecipe({ user_id: null }), isLoading: false };
      render(<RecipeFormPage mode="edit" />);
      expect(screen.getByText('You can only edit your own recipes.')).toBeInTheDocument();
    });
  });
});
