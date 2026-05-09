import { describe, it, expect } from 'vitest';
import { getEventsForDate, getEventsNearDate, getSeason, getTimeOfDay } from './holidays';

describe('getEventsForDate', () => {
  it('returns the event for a date that has one', () => {
    const events = getEventsForDate(new Date(2026, 0, 25)); // Jan 25 — Burns Night
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('Burns Night');
    expect(events[0].cocktail_relevance).toMatch(/Bobby Burns/);
  });

  it('returns empty for a date with no notable event', () => {
    const events = getEventsForDate(new Date(2026, 1, 10)); // Feb 10
    expect(events).toEqual([]);
  });

  it('is year-agnostic — same MM-DD returns same events', () => {
    const a = getEventsForDate(new Date(2024, 6, 4)); // Jul 4 2024
    const b = getEventsForDate(new Date(2030, 6, 4)); // Jul 4 2030
    expect(a).toEqual(b);
    expect(a[0].name).toBe('US Independence Day');
  });

  it('handles single-digit month/day padding correctly', () => {
    // Apr 1 — month=3, day=1 — must format as "04-01" not "4-1"
    const events = getEventsForDate(new Date(2026, 3, 1));
    expect(events[0].name).toBe("April Fools' Day");
  });
});

describe('getEventsNearDate', () => {
  it('annotates events that are not on the target date', () => {
    // Mar 14 (Pi Day) — Ides of March is Mar 15, +1 day
    const events = getEventsNearDate(new Date(2026, 2, 14), 2);
    const piDay = events.find(e => e.name === 'Pi Day');
    const ides = events.find(e => e.name.startsWith('Ides of March'));
    expect(piDay).toBeDefined();
    expect(ides?.name).toBe('Ides of March (in 1 days)');
  });

  it('annotates past events with "ago"', () => {
    // Mar 16 — Ides was Mar 15
    const events = getEventsNearDate(new Date(2026, 2, 16), 2);
    const ides = events.find(e => e.name.startsWith('Ides of March'));
    expect(ides?.name).toBe('Ides of March (1 days ago)');
  });

  it('respects the rangeDays parameter', () => {
    // Range 0 should be equivalent to getEventsForDate
    const events = getEventsNearDate(new Date(2026, 0, 25), 0);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('Burns Night');
  });
});

describe('getSeason', () => {
  it.each([
    [new Date(2026, 0, 15), 'winter'],   // Jan
    [new Date(2026, 2, 1),  'spring'],   // Mar
    [new Date(2026, 4, 30), 'spring'],   // May
    [new Date(2026, 5, 21), 'summer'],   // Jun
    [new Date(2026, 7, 31), 'summer'],   // Aug
    [new Date(2026, 8, 22), 'fall'],     // Sep
    [new Date(2026, 10, 30), 'fall'],    // Nov
    [new Date(2026, 11, 25), 'winter'],  // Dec
  ])('classifies %s as %s', (date, expected) => {
    expect(getSeason(date)).toBe(expected);
  });
});

describe('getTimeOfDay', () => {
  it.each([
    [9,  'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [16, 'afternoon'],
    [17, 'evening'],
    [20, 'evening'],
    [21, 'late night'],
    [23, 'late night'],
    [0,  'morning'],
  ])('classifies hour %s as %s', (hour, expected) => {
    const d = new Date(2026, 0, 1, hour, 30);
    expect(getTimeOfDay(d)).toBe(expected);
  });
});
