// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { claudeMcpAddCommand, generateApiToken, hashApiToken, tokenDisplayPrefix } from './api-tokens';

describe('api tokens', () => {
  it('generates distinct vsp_ tokens with 256 bits of base64url', () => {
    const a = generateApiToken();
    expect(a).not.toBe(generateApiToken());
    expect(a).toMatch(/^vsp_[A-Za-z0-9_-]{43}$/);
  });

  it('matches a known SHA-256 vector', async () => {
    expect(await hashApiToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('keeps a short, non-secret display prefix', () => {
    const token = generateApiToken();
    expect(tokenDisplayPrefix(token)).toBe(token.slice(0, 10));
    expect(tokenDisplayPrefix(token).length).toBe(10);
  });

  it('builds the Claude Code connect command', () => {
    expect(claudeMcpAddCommand('https://vesperant.vercel.app/', 'vsp_x')).toBe(
      'claude mcp add --transport http vesperant https://vesperant.vercel.app/api/mcp --header "Authorization: Bearer vsp_x"',
    );
  });
});
