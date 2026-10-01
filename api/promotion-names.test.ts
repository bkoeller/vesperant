import { describe, it, expect } from 'vitest';
import { resolvePromotedName } from './_lib/promotion-names';

const taken = new Set(['whiskey sour', 'whisky sour', 'boston sour', 'negroni']);

describe('resolvePromotedName', () => {
  it('keeps a new, unused name and its aliases', () => {
    expect(resolvePromotedName({ name: 'Gold Rush', candidate_name: 'Gold Rush', aliases: ['Honey Bourbon Sour'] }, taken))
      .toEqual({ action: 'insert', name: 'Gold Rush', aliases: ['Honey Bourbon Sour'] });
  });

  it('falls back to the candidate name when Claude returns a name already in the library', () => {
    expect(resolvePromotedName({ name: 'Whiskey Sour', candidate_name: 'Rye Whiskey Sour', aliases: ['Rye Sour'] }, taken))
      .toEqual({ action: 'insert', name: 'Rye Whiskey Sour', aliases: ['Rye Sour'] });
  });

  it('matches names case- and whitespace-insensitively, including against aliases', () => {
    expect(resolvePromotedName({ name: '  WHISKY SOUR ', candidate_name: 'Boston Sour' }, taken))
      .toEqual({ action: 'skip', reason: 'duplicate_of:  WHISKY SOUR  (name already in library)' });
  });

  it('skips when both the returned and candidate names are taken', () => {
    const result = resolvePromotedName({ name: 'Negroni', candidate_name: 'negroni' }, taken);
    expect(result.action).toBe('skip');
  });

  it('drops aliases that are taken, blank, duplicated, or equal to the name', () => {
    expect(resolvePromotedName({
      name: 'Rye Whiskey Sour',
      candidate_name: 'Rye Whiskey Sour',
      aliases: ['Whisky Sour', ' ', 'Rye Sour', 'rye sour', 'Rye Whiskey Sour'],
    }, taken)).toEqual({ action: 'insert', name: 'Rye Whiskey Sour', aliases: ['Rye Sour'] });
  });
});
