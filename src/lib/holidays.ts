export interface DateEvent {
  date: string; // "MM-DD"
  name: string;
  category: 'holiday' | 'cultural' | 'birthday' | 'historical';
  cocktail_relevance?: string;
}

const NOTABLE_DATES: DateEvent[] = [
  // January
  { date: '01-01', name: "New Year's Day", category: 'holiday', cocktail_relevance: 'Champagne cocktails, French 75' },
  { date: '01-14', name: 'National Hot Toddy Day', category: 'cultural', cocktail_relevance: 'Hot Toddy, whisky drinks' },
  { date: '01-25', name: 'Burns Night', category: 'cultural', cocktail_relevance: 'Bobby Burns, Scotch cocktails, Rusty Nail' },
  // February
  { date: '02-02', name: 'Groundhog Day', category: 'cultural' },
  { date: '02-14', name: "Valentine's Day", category: 'holiday', cocktail_relevance: 'Champagne cocktails, red/pink drinks' },
  { date: '02-22', name: 'National Margarita Day', category: 'cultural', cocktail_relevance: 'Margarita, tequila cocktails' },
  // March
  { date: '03-14', name: 'Pi Day', category: 'cultural' },
  { date: '03-15', name: 'Ides of March', category: 'historical', cocktail_relevance: 'Roman-inspired, Italian cocktails, Negroni' },
  { date: '03-17', name: "St. Patrick's Day", category: 'holiday', cocktail_relevance: 'Irish whiskey cocktails, Irish Coffee' },
  { date: '03-22', name: 'World Water Day', category: 'cultural', cocktail_relevance: 'Gin and tonic, refreshing cocktails' },
  // April
  { date: '04-01', name: "April Fools' Day", category: 'cultural' },
  { date: '04-13', name: "World Cocktail Day (Cocktail's birthday)", category: 'cultural', cocktail_relevance: 'Old Fashioned, classic cocktails' },
  { date: '04-22', name: 'Earth Day', category: 'cultural', cocktail_relevance: 'Green cocktails, herbal drinks' },
  { date: '04-28', name: 'National Superhero Day', category: 'cultural' },
  // May
  { date: '05-01', name: 'May Day', category: 'cultural', cocktail_relevance: 'Spring cocktails, floral drinks' },
  { date: '05-05', name: 'Cinco de Mayo', category: 'cultural', cocktail_relevance: 'Margarita, Paloma, tequila cocktails' },
  { date: '05-13', name: 'World Cocktail Day', category: 'cultural', cocktail_relevance: 'Any classic cocktail' },
  { date: '05-30', name: 'National Mint Julep Day', category: 'cultural', cocktail_relevance: 'Mint Julep, bourbon cocktails' },
  // June
  { date: '06-12', name: 'National Bourbon Day', category: 'cultural', cocktail_relevance: 'Old Fashioned, Whiskey Sour, Manhattan' },
  { date: '06-19', name: 'National Martini Day', category: 'cultural', cocktail_relevance: 'Martini, Gibson, Vesper' },
  { date: '06-21', name: 'Summer Solstice', category: 'cultural', cocktail_relevance: 'Refreshing cocktails, tiki drinks' },
  // July
  { date: '07-04', name: 'US Independence Day', category: 'holiday', cocktail_relevance: 'American whiskey cocktails, bourbon' },
  { date: '07-11', name: 'National Mojito Day', category: 'cultural', cocktail_relevance: 'Mojito, rum cocktails' },
  { date: '07-19', name: 'National Daiquiri Day', category: 'cultural', cocktail_relevance: 'Daiquiri, rum cocktails' },
  { date: '07-24', name: 'National Tequila Day', category: 'cultural', cocktail_relevance: 'Margarita, Paloma, tequila cocktails' },
  { date: '07-27', name: "Scotch Whisky Day", category: 'cultural', cocktail_relevance: 'Scotch cocktails, Penicillin, Rob Roy' },
  // August
  { date: '08-16', name: 'National Rum Day', category: 'cultural', cocktail_relevance: 'Daiquiri, Mai Tai, rum cocktails' },
  { date: '08-21', name: "National Spiced Rum Day", category: 'cultural', cocktail_relevance: 'Dark and Stormy, spiced rum cocktails' },
  { date: '08-25', name: 'National Whiskey Sour Day', category: 'cultural', cocktail_relevance: 'Whiskey Sour' },
  // September
  { date: '09-01', name: 'Start of Meteorological Fall', category: 'cultural', cocktail_relevance: 'Autumn cocktails, warm spirits' },
  { date: '09-12', name: 'National Chocolate Milkshake Day', category: 'cultural', cocktail_relevance: 'Brandy Alexander, chocolate cocktails' },
  { date: '09-22', name: 'Autumnal Equinox', category: 'cultural', cocktail_relevance: 'Fall cocktails, apple and spice drinks' },
  // October
  { date: '10-04', name: 'National Vodka Day', category: 'cultural', cocktail_relevance: 'Moscow Mule, Martini' },
  { date: '10-19', name: 'National Gin and Tonic Day', category: 'cultural', cocktail_relevance: 'Gin and Tonic' },
  { date: '10-31', name: 'Halloween', category: 'holiday', cocktail_relevance: 'Dark cocktails, smoky drinks, black cocktails' },
  // November
  { date: '11-01', name: 'Dia de los Muertos', category: 'cultural', cocktail_relevance: 'Mezcal, tequila cocktails, Oaxaca Old Fashioned' },
  { date: '11-11', name: "Veterans Day / Armistice Day", category: 'holiday' },
  { date: '11-18', name: 'National Apple Cider Day', category: 'cultural', cocktail_relevance: 'Apple cocktails, hot cider drinks' },
  // December
  { date: '12-05', name: 'Repeal Day (end of Prohibition)', category: 'historical', cocktail_relevance: 'Pre-prohibition classics, Sazerac, Martinez' },
  { date: '12-21', name: 'Winter Solstice', category: 'cultural', cocktail_relevance: 'Warming cocktails, hot drinks, spirit-forward' },
  { date: '12-24', name: 'Christmas Eve', category: 'holiday', cocktail_relevance: 'Eggnog, hot toddy, festive cocktails' },
  { date: '12-25', name: 'Christmas Day', category: 'holiday', cocktail_relevance: 'Eggnog, Champagne cocktails' },
  { date: '12-31', name: "New Year's Eve", category: 'holiday', cocktail_relevance: 'Champagne cocktails, French 75, Kir Royale' },

  // Famous birthdays with cocktail relevance
  { date: '01-15', name: "Martin Luther King Jr.'s Birthday", category: 'birthday' },
  { date: '02-06', name: "Bob Marley's Birthday", category: 'birthday', cocktail_relevance: 'Rum cocktails, Caribbean drinks' },
  { date: '03-02', name: "Dr. Seuss's Birthday", category: 'birthday' },
  { date: '04-15', name: "Leonardo da Vinci's Birthday", category: 'birthday', cocktail_relevance: 'Italian cocktails, Negroni' },
  { date: '06-13', name: "W.B. Yeats's Birthday", category: 'birthday', cocktail_relevance: 'Irish whiskey cocktails' },
  { date: '07-21', name: "Ernest Hemingway's Birthday", category: 'birthday', cocktail_relevance: 'Hemingway Daiquiri, Death in the Afternoon' },
  { date: '08-13', name: "Alfred Hitchcock's Birthday", category: 'birthday', cocktail_relevance: 'Champagne cocktails (his favorite)' },
  { date: '09-15', name: "Agatha Christie's Birthday", category: 'birthday', cocktail_relevance: 'Pink Gin (her preferred drink)' },
  { date: '10-16', name: "Oscar Wilde's Birthday", category: 'birthday', cocktail_relevance: 'Absinthe cocktails, Corpse Reviver' },
  { date: '11-30', name: "Mark Twain's Birthday", category: 'birthday', cocktail_relevance: 'Bourbon cocktails, Whiskey Smash' },
  { date: '12-16', name: "Jane Austen's Birthday", category: 'birthday', cocktail_relevance: 'Sherry cocktails, Bamboo' },
];

export function getEventsForDate(date: Date): DateEvent[] {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return NOTABLE_DATES.filter(e => e.date === mmdd);
}

export function getEventsNearDate(date: Date, rangeDays: number = 2): DateEvent[] {
  const events: DateEvent[] = [];
  for (let d = -rangeDays; d <= rangeDays; d++) {
    const checkDate = new Date(date);
    checkDate.setDate(checkDate.getDate() + d);
    const dayEvents = getEventsForDate(checkDate);
    events.push(...dayEvents.map(e => ({
      ...e,
      name: d === 0 ? e.name : `${e.name} (${d > 0 ? `in ${d} days` : `${Math.abs(d)} days ago`})`,
    })));
  }
  return events;
}

export function getSeason(date: Date): string {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

export function getTimeOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'late night';
}
