import type { SpiritCategory } from '@/types/database.types';

export const CATEGORY_LABELS: Record<SpiritCategory, string> = {
  whisky: 'Whisky',
  gin: 'Gin',
  vodka: 'Vodka',
  rum: 'Rum',
  tequila: 'Tequila',
  mezcal: 'Mezcal',
  brandy: 'Brandy',
  cognac: 'Cognac',
  liqueur: 'Liqueur',
  amaro: 'Amaro',
  vermouth: 'Vermouth',
  bitters: 'Bitters',
  syrup: 'Syrup',
  mixer: 'Mixer',
  garnish: 'Garnish',
  wine: 'Wine',
  beer: 'Beer',
  other: 'Other',
};

export const CATEGORY_ORDER: SpiritCategory[] = [
  'whisky', 'gin', 'vodka', 'rum', 'tequila', 'mezcal',
  'brandy', 'cognac', 'liqueur', 'amaro', 'vermouth',
  'bitters', 'syrup', 'mixer', 'garnish', 'wine', 'beer', 'other',
];

export const PRICE_TIER_OPTIONS = [
  { value: 'budget', label: 'Budget' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
] as const;
