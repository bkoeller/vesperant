import { createHash } from 'node:crypto';

// Server half of the personal API token scheme (client half: src/lib/api-tokens.ts).
// Tokens are "vsp_" + 32 random bytes as base64url (43 chars). Only the
// SHA-256 hex digest is stored in api_tokens.token_hash.

const TOKEN_PATTERN = /^vsp_[A-Za-z0-9_-]{43}$/;

export function looksLikeApiToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
