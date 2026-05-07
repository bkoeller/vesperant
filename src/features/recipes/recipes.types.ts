import type { CocktailMethod, IngredientRole } from '@/types/database.types';

export const METHOD_LABELS: Record<CocktailMethod, string> = {
  stir: 'Stirred',
  shake: 'Shaken',
  build: 'Built',
  blend: 'Blended',
  muddle: 'Muddled',
  layer: 'Layered',
  other: 'Other',
};

export const METHOD_ORDER: CocktailMethod[] = ['stir', 'shake', 'build', 'blend', 'muddle', 'layer', 'other'];

export const ROLE_LABELS: Record<IngredientRole, string> = {
  base: 'Base',
  modifier: 'Modifier',
  accent: 'Accent',
  sweetener: 'Sweetener',
  sour: 'Sour',
  bitters: 'Bitters',
  garnish: 'Garnish',
  topper: 'Topper',
  rinse: 'Rinse',
  other: 'Other',
};

export const ROLE_ORDER: IngredientRole[] = [
  'base', 'modifier', 'accent', 'sweetener', 'sour', 'bitters', 'topper', 'rinse', 'garnish', 'other',
];

export const UNIT_OPTIONS = ['oz', 'ml', 'dash', 'dashes', 'drop', 'drops', 'tsp', 'tbsp', 'cup', 'splash', 'barspoon', 'piece', 'leaf', 'sprig', 'wedge', 'twist', ''] as const;

export const FILTER_TAGS = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'tiki', label: 'Tiki' },
  { value: 'aperitif', label: 'Aperitif' },
  { value: 'after-dinner', label: 'After Dinner' },
  { value: 'spirit-forward', label: 'Spirit-Forward' },
  { value: 'sour', label: 'Sour' },
  { value: 'bitter', label: 'Bitter' },
  { value: 'refreshing', label: 'Refreshing' },
  { value: 'scotch', label: 'Scotch' },
  { value: 'bourbon', label: 'Bourbon' },
  { value: 'gin', label: 'Gin' },
  { value: 'rum', label: 'Rum' },
  { value: 'tequila', label: 'Tequila' },
] as const;
