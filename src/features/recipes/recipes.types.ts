import type { CocktailMethod } from '@/types/database.types';

export const METHOD_LABELS: Record<CocktailMethod, string> = {
  stir: 'Stirred',
  shake: 'Shaken',
  build: 'Built',
  blend: 'Blended',
  muddle: 'Muddled',
  layer: 'Layered',
  other: 'Other',
};

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
