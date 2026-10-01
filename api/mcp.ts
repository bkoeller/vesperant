import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { hashApiToken, looksLikeApiToken } from './_lib/api-token.js';
import { createVesperantMcpServer } from './_lib/mcp-tools.js';

// Read-only MCP endpoint for AI agents (e.g. Claude Code). Authenticated by
// a personal API token from Settings → Agent access; every tool is scoped to
// the token owner's data. Stateless: each POST gets a fresh server/transport.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function rpcError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Stateless servers have no SSE stream to GET and no session to DELETE.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return rpcError(res, 405, 'Method not allowed');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return rpcError(res, 500, 'Server is missing Supabase configuration');
  }

  // ---- Auth: personal API token ----
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!looksLikeApiToken(token)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return rpcError(res, 401, 'Missing or malformed API token. Create one in Vesperant → Settings → Agent access.');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tokenRow } = await admin
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', hashApiToken(token))
    .maybeSingle();
  if (!tokenRow) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    return rpcError(res, 401, 'Invalid or revoked API token');
  }

  // ---- Allowlist re-check: revoking a user's access also disables their tokens ----
  const { data: userData } = await admin.auth.admin.getUserById(tokenRow.user_id);
  const email = userData?.user?.email;
  const { data: allowed } = email
    ? await admin.from('allowed_emails').select('email').ilike('email', email).eq('is_active', true).maybeSingle()
    : { data: null };
  if (!allowed) {
    return rpcError(res, 403, 'Access not granted');
  }

  await admin.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id);

  // ---- MCP ----
  const server = createVesperantMcpServer(admin, tokenRow.user_id);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp.ts] request failed', err);
    if (!res.headersSent) rpcError(res, 500, 'Internal server error');
  }
}
