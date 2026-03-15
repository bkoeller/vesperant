import type { SpiritCategory, PriceTier } from '@/types/database.types';

export interface BottleSeed {
  name: string;
  brand: string;
  category: SpiritCategory;
  subcategory: string;
  spirit_type: string | null;
  tags: string[];
  abv: number | null;
  is_premium: boolean;
  price_tier: PriceTier;
}

export const KOELLER_BAR_INVENTORY: BottleSeed[] = [
  // SCOTCH WHISKY — SINGLE MALT
  { name: 'Aberlour 12 Year Old Double Cask Matured', brand: 'Aberlour', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside', 'sherry cask'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'anCnoc 12 Year Old', brand: 'anCnoc', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Highland Single Malt', tags: ['Highland'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: "Ardbeg Anthology: The Harpy's Tale 13 Year Old", brand: 'Ardbeg', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated', 'limited edition'], abv: 46, is_premium: true, price_tier: 'premium' },
  { name: 'Ardbeg Corryvreckan', brand: 'Ardbeg', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated', 'cask strength'], abv: 57.1, is_premium: true, price_tier: 'premium' },
  { name: 'The Balvenie Caribbean Cask 14 Year Old', brand: 'The Balvenie', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside', 'rum cask'], abv: 43, is_premium: true, price_tier: 'premium' },
  { name: 'The Balvenie DoubleWood 12 Year Old', brand: 'The Balvenie', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside', 'sherry cask'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Benromach 15 Year Old', brand: 'Benromach', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside'], abv: 43, is_premium: true, price_tier: 'premium' },
  { name: 'Bowmore 12 Year Old', brand: 'Bowmore', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Bruichladdich Black Art (Edition 10.1)', brand: 'Bruichladdich', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'unpeated', 'limited edition'], abv: 45.1, is_premium: true, price_tier: 'luxury' },
  { name: 'Bunnahabhain 12 Year Old', brand: 'Bunnahabhain', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'unpeated'], abv: 46.3, is_premium: false, price_tier: 'standard' },
  { name: 'Bunnahabhain Hand Filled Exclusive Warehouse 9', brand: 'Bunnahabhain', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'single cask', 'distillery exclusive'], abv: null, is_premium: true, price_tier: 'luxury' },
  { name: 'Signatory Vintage Bunnahabhain 2007 13 Year Old (Cask Strength)', brand: 'Signatory Vintage', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'cask strength', 'independent bottling'], abv: null, is_premium: true, price_tier: 'premium' },
  { name: 'Duncan Taylor Bunnahabhain Aged 14 Years (Dimensions Collection)', brand: 'Duncan Taylor', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'independent bottling'], abv: null, is_premium: true, price_tier: 'premium' },
  { name: 'Caol Ila 12 Year Old', brand: 'Caol Ila', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated'], abv: 43, is_premium: false, price_tier: 'standard' },
  { name: 'Glenfiddich 12 Year Old', brand: 'Glenfiddich', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Glenfiddich 15 Year Old Solera Reserve', brand: 'Glenfiddich', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside', 'solera'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'The Glenlivet 12 Year Old', brand: 'The Glenlivet', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'The Glenlivet 1824 Caribbean Reserve', brand: 'The Glenlivet', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside', 'rum cask'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Kilchoman Small Batch (Red Wine Cask Matured)', brand: 'Kilchoman', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated', 'red wine cask'], abv: null, is_premium: true, price_tier: 'premium' },
  { name: 'Kilchoman Machir Bay', brand: 'Kilchoman', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated'], abv: 46, is_premium: false, price_tier: 'standard' },
  { name: "Lagavulin 12 Year Old Special Release 2021 (The Lion's Fire)", brand: 'Lagavulin', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated', 'cask strength', 'special release'], abv: 56.5, is_premium: true, price_tier: 'premium' },
  { name: 'Lagavulin 16 Year Old', brand: 'Lagavulin', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated'], abv: 43, is_premium: true, price_tier: 'premium' },
  { name: 'Laphroaig Select', brand: 'Laphroaig', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Laphroaig Lore', brand: 'Laphroaig', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated'], abv: 48, is_premium: true, price_tier: 'premium' },
  { name: 'Laphroaig The 1815 Legacy Edition', brand: 'Laphroaig', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated'], abv: 48, is_premium: true, price_tier: 'premium' },
  { name: 'Laphroaig Hand Filled Cask', brand: 'Laphroaig', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated', 'cask strength', 'distillery exclusive'], abv: null, is_premium: true, price_tier: 'luxury' },
  { name: 'The Macallan 12 Year Old Sherry Oak Cask', brand: 'The Macallan', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside', 'sherry cask'], abv: 40, is_premium: true, price_tier: 'premium' },
  { name: 'Oban Little Bay', brand: 'Oban', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Highland Single Malt', tags: ['Highland'], abv: 43, is_premium: false, price_tier: 'standard' },
  { name: 'Octomore 15.1', brand: 'Bruichladdich', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'heavily peated', 'cask strength'], abv: 59.1, is_premium: true, price_tier: 'luxury' },
  { name: 'Old Pulteney 12 Year Old', brand: 'Old Pulteney', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Highland Single Malt', tags: ['Highland', 'maritime'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Port Charlotte 10 Year Old Heavily Peated', brand: 'Bruichladdich', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'heavily peated'], abv: 50, is_premium: false, price_tier: 'standard' },
  { name: 'Scarabus Islay Single Malt', brand: 'Scarabus', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'peated'], abv: 46, is_premium: false, price_tier: 'budget' },
  { name: 'Signatory Vintage Bruichladdich 1990 27 Year Old', brand: 'Signatory Vintage', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Islay Single Malt', tags: ['Islay', 'unpeated', 'independent bottling', 'aged'], abv: null, is_premium: true, price_tier: 'luxury' },
  { name: 'Tamdhu 12 Year Old', brand: 'Tamdhu', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside', 'sherry cask'], abv: 43, is_premium: false, price_tier: 'standard' },
  { name: 'Tamdhu 15 Year Old', brand: 'Tamdhu', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Speyside Single Malt', tags: ['Speyside', 'sherry cask'], abv: 46, is_premium: true, price_tier: 'premium' },
  { name: 'The Famous Grouse: Blended Scotch Whisky', brand: 'The Famous Grouse', category: 'whisky', subcategory: 'Scotch Whisky', spirit_type: 'Blended Scotch', tags: ['blended'], abv: 40, is_premium: false, price_tier: 'budget' },
  // WORLD WHISKY
  { name: 'Bushmills The Original Irish Whiskey', brand: 'Bushmills', category: 'whisky', subcategory: 'Irish Whiskey', spirit_type: 'Irish Whiskey', tags: ['Irish'], abv: 40, is_premium: false, price_tier: 'budget' },
  { name: 'Copperworks American Single Malt Whiskey', brand: 'Copperworks', category: 'whisky', subcategory: 'American Whiskey', spirit_type: 'American Single Malt', tags: ['American', 'craft'], abv: 50, is_premium: true, price_tier: 'premium' },
  { name: 'Kavalan Concertmaster Port Cask Finish', brand: 'Kavalan', category: 'whisky', subcategory: 'World Whisky', spirit_type: 'Taiwanese Single Malt', tags: ['Taiwan', 'port cask'], abv: 40, is_premium: true, price_tier: 'premium' },
  { name: 'Kavalan Single Malt Whisky', brand: 'Kavalan', category: 'whisky', subcategory: 'World Whisky', spirit_type: 'Taiwanese Single Malt', tags: ['Taiwan'], abv: 40, is_premium: true, price_tier: 'premium' },
  { name: 'Old Forester Kentucky Straight Bourbon Whisky', brand: 'Old Forester', category: 'whisky', subcategory: 'Bourbon', spirit_type: 'Kentucky Straight Bourbon', tags: ['bourbon', 'American'], abv: 43, is_premium: false, price_tier: 'standard' },
  { name: 'High West Distillery: Double Rye!', brand: 'High West', category: 'whisky', subcategory: 'Rye Whiskey', spirit_type: 'American Rye', tags: ['rye', 'American', 'craft'], abv: 46, is_premium: false, price_tier: 'standard' },
  // GIN
  { name: 'Aviation American Gin', brand: 'Aviation', category: 'gin', subcategory: 'American Gin', spirit_type: null, tags: ['American', 'new western'], abv: 42, is_premium: false, price_tier: 'standard' },
  { name: 'The Botanist Islay Dry Gin', brand: 'The Botanist', category: 'gin', subcategory: 'Dry Gin', spirit_type: null, tags: ['Islay', 'botanical'], abv: 46, is_premium: true, price_tier: 'premium' },
  { name: 'Copperworks Northwest Small Batch Gin', brand: 'Copperworks', category: 'gin', subcategory: 'Dry Gin', spirit_type: null, tags: ['American', 'craft'], abv: 47.3, is_premium: true, price_tier: 'premium' },
  { name: 'Tanqueray London Dry Gin', brand: 'Tanqueray', category: 'gin', subcategory: 'London Dry Gin', spirit_type: null, tags: ['London Dry'], abv: 47.3, is_premium: false, price_tier: 'standard' },
  // RUM & CACHACA
  { name: 'Bacardi Superior White Rum', brand: 'Bacardi', category: 'rum', subcategory: 'White Rum', spirit_type: null, tags: ['white', 'light'], abv: 40, is_premium: false, price_tier: 'budget' },
  { name: 'Captain Morgan Original Spiced Rum', brand: 'Captain Morgan', category: 'rum', subcategory: 'Spiced Rum', spirit_type: null, tags: ['spiced'], abv: 35, is_premium: false, price_tier: 'budget' },
  { name: "Doorly's 12 Year Old Barbados Rum", brand: "Doorly's", category: 'rum', subcategory: 'Aged Rum', spirit_type: null, tags: ['Barbados', 'aged'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Malibu Coconut Rum', brand: 'Malibu', category: 'rum', subcategory: 'Flavored Rum', spirit_type: null, tags: ['coconut', 'flavored'], abv: 21, is_premium: false, price_tier: 'budget' },
  { name: "Myers's Original Dark Rum", brand: "Myers's", category: 'rum', subcategory: 'Dark Rum', spirit_type: null, tags: ['dark', 'Jamaican'], abv: 40, is_premium: false, price_tier: 'budget' },
  { name: 'Old Brigand Black Label Barbados Rum', brand: 'Old Brigand', category: 'rum', subcategory: 'Dark Rum', spirit_type: null, tags: ['Barbados', 'dark'], abv: 43, is_premium: false, price_tier: 'budget' },
  { name: 'Sailor Jerry Spiced Rum', brand: 'Sailor Jerry', category: 'rum', subcategory: 'Spiced Rum', spirit_type: null, tags: ['spiced'], abv: 46, is_premium: false, price_tier: 'budget' },
  { name: 'Cana Boa Cachaça', brand: 'Cana Boa', category: 'rum', subcategory: 'Cachaça', spirit_type: null, tags: ['cachaça', 'Brazilian'], abv: 40, is_premium: false, price_tier: 'standard' },
  // TEQUILA
  { name: 'El Padrino Blanco Tequila', brand: 'El Padrino', category: 'tequila', subcategory: 'Blanco', spirit_type: null, tags: ['blanco'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Herradura Reposado Tequila', brand: 'Herradura', category: 'tequila', subcategory: 'Reposado', spirit_type: null, tags: ['reposado'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Adictivo Tequila: Extra Añejo (Black Bottle)', brand: 'Adictivo', category: 'tequila', subcategory: 'Extra Añejo', spirit_type: null, tags: ['extra añejo', 'aged'], abv: 40, is_premium: true, price_tier: 'premium' },
  // BRANDY & COGNAC
  { name: 'Christian Brothers Brandy', brand: 'Christian Brothers', category: 'brandy', subcategory: 'American Brandy', spirit_type: null, tags: ['American'], abv: 40, is_premium: false, price_tier: 'budget' },
  { name: 'Grand Marnier Cordon Rouge', brand: 'Grand Marnier', category: 'liqueur', subcategory: 'Orange Liqueur', spirit_type: null, tags: ['orange', 'cognac-based'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Pierre Ferrand 1840 Original Formula Cognac', brand: 'Pierre Ferrand', category: 'cognac', subcategory: 'Cognac', spirit_type: null, tags: ['Grande Champagne'], abv: 45, is_premium: true, price_tier: 'premium' },
  // LIQUEURS, AMARI & VERMOUTH
  { name: 'Absolut Vanilia Vodka', brand: 'Absolut', category: 'vodka', subcategory: 'Flavored Vodka', spirit_type: null, tags: ['vanilla', 'flavored'], abv: 38, is_premium: false, price_tier: 'budget' },
  { name: 'Amaro Nonino Quintessentia', brand: 'Nonino', category: 'amaro', subcategory: 'Amaro', spirit_type: null, tags: ['Italian'], abv: 35, is_premium: true, price_tier: 'premium' },
  { name: 'Antica Formula Carpano Vermouth', brand: 'Carpano', category: 'vermouth', subcategory: 'Sweet Vermouth', spirit_type: null, tags: ['Italian', 'sweet'], abv: 16.5, is_premium: true, price_tier: 'premium' },
  { name: 'Aperol', brand: 'Aperol', category: 'liqueur', subcategory: 'Aperitif', spirit_type: null, tags: ['Italian', 'bitter', 'aperitif'], abv: 11, is_premium: false, price_tier: 'standard' },
  { name: 'Baileys Original Irish Cream', brand: 'Baileys', category: 'liqueur', subcategory: 'Cream Liqueur', spirit_type: null, tags: ['cream', 'Irish'], abv: 17, is_premium: false, price_tier: 'budget' },
  { name: 'Benedictine D.O.M.', brand: 'Benedictine', category: 'liqueur', subcategory: 'Herbal Liqueur', spirit_type: null, tags: ['herbal', 'French'], abv: 40, is_premium: true, price_tier: 'premium' },
  { name: 'Campari', brand: 'Campari', category: 'amaro', subcategory: 'Bitter Liqueur', spirit_type: null, tags: ['Italian', 'bitter'], abv: 25, is_premium: false, price_tier: 'standard' },
  { name: 'Chartreuse Green', brand: 'Chartreuse', category: 'liqueur', subcategory: 'Herbal Liqueur', spirit_type: null, tags: ['herbal', 'French', 'monastic'], abv: 55, is_premium: true, price_tier: 'premium' },
  { name: 'Cocchi Americano', brand: 'Cocchi', category: 'vermouth', subcategory: 'Americano', spirit_type: null, tags: ['Italian', 'aperitif'], abv: 16.5, is_premium: false, price_tier: 'standard' },
  { name: 'Drambuie', brand: 'Drambuie', category: 'liqueur', subcategory: 'Whisky Liqueur', spirit_type: null, tags: ['Scottish', 'honey', 'herbal'], abv: 40, is_premium: false, price_tier: 'standard' },
  { name: 'Goldschlager', brand: 'Goldschlager', category: 'liqueur', subcategory: 'Cinnamon Liqueur', spirit_type: null, tags: ['cinnamon', 'gold flakes'], abv: 43.5, is_premium: false, price_tier: 'budget' },
  { name: 'Kahlúa', brand: 'Kahlúa', category: 'liqueur', subcategory: 'Coffee Liqueur', spirit_type: null, tags: ['coffee', 'Mexican'], abv: 20, is_premium: false, price_tier: 'budget' },
  { name: 'Lillet Blanc', brand: 'Lillet', category: 'vermouth', subcategory: 'Aromatized Wine', spirit_type: null, tags: ['French', 'aperitif'], abv: 17, is_premium: false, price_tier: 'standard' },
  { name: 'Limoncello Gabriello', brand: 'Gabriello', category: 'liqueur', subcategory: 'Limoncello', spirit_type: null, tags: ['Italian', 'lemon'], abv: 30, is_premium: false, price_tier: 'budget' },
  { name: 'Luksusowa Potato Vodka', brand: 'Luksusowa', category: 'vodka', subcategory: 'Vodka', spirit_type: null, tags: ['Polish', 'potato'], abv: 40, is_premium: false, price_tier: 'budget' },
  { name: 'Luxardo Maraschino Liqueur', brand: 'Luxardo', category: 'liqueur', subcategory: 'Cherry Liqueur', spirit_type: null, tags: ['Italian', 'cherry', 'maraschino'], abv: 32, is_premium: false, price_tier: 'standard' },
  { name: 'Martini & Rossi Extra Dry Vermouth', brand: 'Martini & Rossi', category: 'vermouth', subcategory: 'Dry Vermouth', spirit_type: null, tags: ['Italian', 'dry'], abv: 15, is_premium: false, price_tier: 'budget' },
  { name: 'Mr. Stacks Blue Curacao', brand: 'Mr. Stacks', category: 'liqueur', subcategory: 'Curacao', spirit_type: null, tags: ['blue', 'orange'], abv: 15, is_premium: false, price_tier: 'budget' },
  { name: 'Punt e Mes', brand: 'Carpano', category: 'vermouth', subcategory: 'Sweet Vermouth', spirit_type: null, tags: ['Italian', 'bitter', 'sweet'], abv: 16, is_premium: false, price_tier: 'standard' },
  { name: 'Rumple Minze', brand: 'Rumple Minze', category: 'liqueur', subcategory: 'Peppermint Liqueur', spirit_type: null, tags: ['peppermint', 'German'], abv: 50, is_premium: false, price_tier: 'budget' },
  // MIXERS & GARNISHES
  { name: 'Lakewood Organic Pure Pineapple Juice', brand: 'Lakewood', category: 'mixer', subcategory: 'Juice', spirit_type: null, tags: ['pineapple', 'organic'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: 'Santa Cruz Organic Lemon Juice', brand: 'Santa Cruz', category: 'mixer', subcategory: 'Juice', spirit_type: null, tags: ['lemon', 'organic'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: 'Realemon Lemon Juice', brand: 'ReaLemon', category: 'mixer', subcategory: 'Juice', spirit_type: null, tags: ['lemon'], abv: null, is_premium: false, price_tier: 'budget' },
  { name: 'ReaLime Lime Juice', brand: 'ReaLime', category: 'mixer', subcategory: 'Juice', spirit_type: null, tags: ['lime'], abv: null, is_premium: false, price_tier: 'budget' },
  { name: 'Sicilia Lime Juice', brand: 'Sicilia', category: 'mixer', subcategory: 'Juice', spirit_type: null, tags: ['lime'], abv: null, is_premium: false, price_tier: 'budget' },
  { name: 'Mezzetta Spanish Queen Martini Olives', brand: 'Mezzetta', category: 'garnish', subcategory: 'Olives', spirit_type: null, tags: ['olives', 'martini'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: 'Tillen Farms Merry Maraschino Cherries', brand: 'Tillen Farms', category: 'garnish', subcategory: 'Cherries', spirit_type: null, tags: ['cherries', 'maraschino'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: 'Porto Rocha 10 Year Old Tawny Port', brand: 'Porto Rocha', category: 'wine', subcategory: 'Port', spirit_type: null, tags: ['tawny', 'Portuguese'], abv: 19.5, is_premium: false, price_tier: 'standard' },
  // BITTERS
  { name: "Scrappy's Bitters: Grapefruit", brand: "Scrappy's", category: 'bitters', subcategory: 'Bitters', spirit_type: null, tags: ['grapefruit', 'craft'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: 'Angostura: Aromatic Bitters', brand: 'Angostura', category: 'bitters', subcategory: 'Aromatic Bitters', spirit_type: null, tags: ['aromatic', 'classic'], abv: 44.7, is_premium: false, price_tier: 'standard' },
  { name: 'Fee Brothers: Cherry Bitters', brand: 'Fee Brothers', category: 'bitters', subcategory: 'Bitters', spirit_type: null, tags: ['cherry'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: 'Fee Brothers: West Indian Orange Bitters', brand: 'Fee Brothers', category: 'bitters', subcategory: 'Orange Bitters', spirit_type: null, tags: ['orange'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: 'Angostura: Orange Bitters', brand: 'Angostura', category: 'bitters', subcategory: 'Orange Bitters', spirit_type: null, tags: ['orange'], abv: 28, is_premium: false, price_tier: 'standard' },
  { name: "Scrappy's Bitters: Orange", brand: "Scrappy's", category: 'bitters', subcategory: 'Orange Bitters', spirit_type: null, tags: ['orange', 'craft'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: "Scrappy's Bitters: Chocolate", brand: "Scrappy's", category: 'bitters', subcategory: 'Bitters', spirit_type: null, tags: ['chocolate', 'craft'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: "Peychaud's: Aromatic Cocktail Bitters", brand: "Peychaud's", category: 'bitters', subcategory: 'Aromatic Bitters', spirit_type: null, tags: ['aromatic', 'New Orleans'], abv: 35, is_premium: false, price_tier: 'standard' },
  // SYRUPS
  { name: 'Barrel Roll: Demerara Simple Syrup', brand: 'Barrel Roll', category: 'syrup', subcategory: 'Simple Syrup', spirit_type: null, tags: ['demerara'], abv: null, is_premium: false, price_tier: 'standard' },
  { name: 'Stirrings: Simple Syrup (Cane Sugar)', brand: 'Stirrings', category: 'syrup', subcategory: 'Simple Syrup', spirit_type: null, tags: ['cane sugar'], abv: null, is_premium: false, price_tier: 'standard' },
];
