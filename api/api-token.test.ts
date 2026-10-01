// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hashApiToken, looksLikeApiToken } from './_lib/api-token';
import { generateApiToken, hashApiToken as browserHash } from '../src/lib/api-tokens';

describe('api/_lib/api-token', () => {
  it('accepts tokens minted by the Settings panel', () => {
    expect(looksLikeApiToken(generateApiToken())).toBe(true);
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'vsp_', 'vsp_short', `vsp_${'a'.repeat(44)}`, `xyz_${'a'.repeat(43)}`, `vsp_${'a'.repeat(42)}=`]) {
      expect(looksLikeApiToken(bad)).toBe(false);
    }
  });

  it('hashes identically to the browser (WebCrypto) so stored hashes match', async () => {
    for (const token of [generateApiToken(), generateApiToken()]) {
      expect(hashApiToken(token)).toBe(await browserHash(token));
    }
  });
});
