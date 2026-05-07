import {
  createRootRoute,
  createRoute,
  redirect,
} from '@tanstack/react-router';
import { Shell } from '@/components/layout/Shell';
import { TonightPage } from '@/features/suggestions/components/TonightPage';
import { InventoryPage } from '@/features/inventory/components/InventoryPage';
import { RecipesPage } from '@/features/recipes/components/RecipesPage';
import { RecipeDetailPage } from '@/features/recipes/components/RecipeDetailPage';
import { RecipeFormPage } from '@/features/recipes/components/RecipeFormPage';
import { HistoryPage } from '@/features/cocktail-log/components/HistoryPage';
import { SettingsPage } from '@/features/settings/components/SettingsPage';

const rootRoute = createRootRoute({
  component: Shell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/tonight' });
  },
});

const tonightRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tonight',
  component: TonightPage,
});

const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inventory',
  component: InventoryPage,
});

const recipesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes',
  component: RecipesPage,
});

const recipeNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/new',
  component: () => <RecipeFormPage mode="new" />,
});

const recipeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/$slug',
  component: RecipeDetailPage,
});

const recipeEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/$slug/edit',
  component: () => <RecipeFormPage mode="edit" />,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: HistoryPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  tonightRoute,
  inventoryRoute,
  recipesRoute,
  recipeNewRoute,
  recipeDetailRoute,
  recipeEditRoute,
  historyRoute,
  settingsRoute,
]);
