// Client half of the personal API token scheme (server half: api/_lib/api-token.ts).
// The plaintext token is generated here, shown to the user once, and never
// stored: only its SHA-256 hex digest goes to the api_tokens table.

export const API_TOKEN_PREFIX = 'vsp_';

/** Characters of the token kept for display so users can tell tokens apart. */
const DISPLAY_PREFIX_LENGTH = 10;

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateApiToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return API_TOKEN_PREFIX + base64url(bytes);
}

export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export function tokenDisplayPrefix(token: string): string {
  return token.slice(0, DISPLAY_PREFIX_LENGTH);
}

/** The command a user pastes into a terminal to connect Claude Code. */
export function claudeMcpAddCommand(origin: string, token: string): string {
  return `claude mcp add --transport http vesperant ${origin.replace(/\/$/, '')}/api/mcp --header "Authorization: Bearer ${token}"`;
}
