// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { hashApiToken } from './_lib/api-token';

// End-to-end over HTTP: the real handler and MCP server, driven by the real
// MCP client, against a fake Supabase that applies eq/is/or/gte filters the
// way PostgREST would. Fixtures include a second user's data, so any tool
// that forgets its user scope leaks OTHER_USER rows and fails these tests.

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER_USER = '22222222-2222-2222-2222-222222222222';
const TOKEN = 'vsp_' + 'a'.repeat(43);
const OTHER_TOKEN = 'vsp_' + 'b'.repeat(43);

type Row = Record<string, unknown>;

const fixtures: Record<string, Row[]> = {};
let usersById: Record<string, string>;
let allowedEmails: string[];
let makeableRows: Row[];
const updates: { table: string; values: Row }[] = [];

function resetFixtures() {
  usersById = { [ME]: 'me@example.com', [OTHER_USER]: 'other@example.com' };
  allowedEmails = ['me@example.com', 'other@example.com'];
  updates.length = 0;
  fixtures.api_tokens = [
    { id: 't1', user_id: ME, token_hash: hashApiToken(TOKEN) },
    { id: 't2', user_id: OTHER_USER, token_hash: hashApiToken(OTHER_TOKEN) },
  ];
  fixtures.bottles = [
    { id: 'b1', user_id: ME, name: 'Hendricks', category: 'gin', active: true },
    { id: 'b2', user_id: ME, name: 'Old Campari', category: 'amaro', active: false },
    { id: 'b3', user_id: OTHER_USER, name: 'Their Rum', category: 'rum', active: true },
  ];
  fixtures.recipes = [
    { id: 'r1', user_id: null, name: 'Negroni', slug: 'negroni', aliases: [], tags: ['classic', 'bitter'], method: 'stir',
      recipe_ingredients: [
        { ingredient_name: 'Campari', role: 'modifier', sort_order: 2 },
        { ingredient_name: 'Gin', role: 'base', sort_order: 0 },
      ] },
    { id: 'r2', user_id: ME, name: 'My Negroni', slug: 'negroni', aliases: ['House Negroni'], tags: ['classic'], method: 'stir', recipe_ingredients: [] },
    { id: 'r3', user_id: OTHER_USER, name: 'Secret Sour', slug: 'secret-sour', aliases: [], tags: ['sour'], method: 'shake', recipe_ingredients: [] },
  ];
  fixtures.cocktail_logs = [
    { user_id: ME, recipe_name: 'Negroni', rating: 5, bottles_used: ['b1'], logged_at: '2026-09-20T20:00:00Z' },
    { user_id: ME, recipe_name: 'Gimlet', rating: 3, bottles_used: [], logged_at: '2026-08-01T20:00:00Z' },
    { user_id: OTHER_USER, recipe_name: 'Their Daiquiri', rating: 4, bottles_used: ['b3'], logged_at: '2026-09-21T20:00:00Z' },
  ];
  fixtures.suggestion_sessions = [
    { user_id: ME, created_at: '2026-09-20T19:00:00Z', context_signals: { mood: 'cozy' },
      suggestions: [{ recipe_name: 'Negroni', archetype: 'safe', reasoning: 'r', selected: true, sort_order: 0 }] },
    { user_id: OTHER_USER, created_at: '2026-09-21T19:00:00Z', context_signals: {}, suggestions: [] },
  ];
  // As the service role, get_makeable_recipes spans every user's recipes.
  makeableRows = [
    { recipe_id: 'r1', recipe_name: 'Negroni', missing_count: 0, missing_ingredients: null },
    { recipe_id: 'r3', recipe_name: 'Secret Sour', missing_count: 0, missing_ingredients: null },
    { recipe_id: 'r2', recipe_name: 'My Negroni', missing_count: 1, missing_ingredients: ['Sweet vermouth'] },
  ];
}

// ---- Minimal PostgREST-ish fake ----
function matches(row: Row, col: string, op: string, value: unknown): boolean {
  const v = row[col];
  if (op === 'eq') return String(v) === String(value);
  if (op === 'is') return value === null || value === 'null' ? v === null || v === undefined : v === value;
  if (op === 'ilike') return String(v).toLowerCase() === String(value).toLowerCase();
  if (op === 'gte') return String(v) >= String(value);
  throw new Error(`fake: unsupported op ${op}`);
}

function queryBuilder(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let single = false;
  let limit: number | undefined;
  let update: Row | undefined;
  const b = {
    select: () => b,
    order: () => b,
    eq: (c: string, v: unknown) => { filters.push(r => matches(r, c, 'eq', v)); return b; },
    is: (c: string, v: unknown) => { filters.push(r => matches(r, c, 'is', v)); return b; },
    ilike: (c: string, v: unknown) => { filters.push(r => matches(r, c, 'ilike', v)); return b; },
    gte: (c: string, v: unknown) => { filters.push(r => matches(r, c, 'gte', v)); return b; },
    or: (expr: string) => {
      const clauses = expr.split(',').map(part => {
        const [col, op, ...rest] = part.split('.');
        return { col, op, value: rest.join('.') };
      });
      filters.push(r => clauses.some(c => matches(r, c.col, c.op, c.value)));
      return b;
    },
    limit: (n: number) => { limit = n; return b; },
    maybeSingle: () => { single = true; return b; },
    update: (values: Row) => { update = values; return b; },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      if (update) {
        updates.push({ table, values: update });
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      }
      let rows = table === 'allowed_emails'
        ? allowedEmails.map(email => ({ email, is_active: true }))
        : (fixtures[table] ?? []);
      rows = rows.filter(r => filters.every(f => f(r)));
      if (limit !== undefined) rows = rows.slice(0, limit);
      const data = single ? rows[0] ?? null : rows;
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return b;
}

const rpcCalls: { fn: string; args: unknown }[] = [];
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => queryBuilder(table),
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: makeableRows, error: null });
    },
    auth: {
      admin: {
        getUserById: (id: string) =>
          Promise.resolve({ data: { user: usersById[id] ? { id, email: usersById[id] } : null }, error: null }),
      },
    },
  }),
}));

// ---- HTTP harness: Node server + VercelResponse shim ----
let server: http.Server;
let url: string;

beforeAll(async () => {
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  const { default: handler } = await import('./mcp');

  server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const vReq = Object.assign(req, { body: raw ? JSON.parse(raw) : undefined }) as unknown as VercelRequest;
    const vRes = Object.assign(res, {
      status(code: number) { res.statusCode = code; return vRes; },
      json(body: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return vRes; },
    }) as unknown as VercelResponse;
    await handler(vReq, vRes);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mcp`;
});

afterAll(() => new Promise<void>(r => server.close(() => r())));

beforeEach(() => {
  resetFixtures();
  rpcCalls.length = 0;
});

async function connect(token = TOKEN) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }));
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  if (result.isError) throw new Error(content[0].text);
  return JSON.parse(content[0].text);
}

function rawPost(headers: Record<string, string>) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
}

describe('api/mcp auth gate', () => {
  it('rejects non-POST methods', async () => {
    const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(405);
  });

  it('rejects a missing token', async () => {
    const res = await rawPost({});
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Bearer');
  });

  it('rejects a malformed token without touching the database', async () => {
    const res = await rawPost({ Authorization: 'Bearer not-a-token' });
    expect(res.status).toBe(401);
  });

  it('rejects a well-formed token that is not on record (revoked or never issued)', async () => {
    const res = await rawPost({ Authorization: `Bearer vsp_${'z'.repeat(43)}` });
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toMatch(/Invalid or revoked/);
  });

  it('rejects a valid token whose owner is no longer allowlisted', async () => {
    allowedEmails = ['other@example.com'];
    const res = await rawPost({ Authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(403);
  });

  it('accepts a valid token and stamps last_used_at', async () => {
    const res = await rawPost({ Authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ table: 'api_tokens', values: { last_used_at: expect.any(String) } }]);
  });
});

describe('api/mcp tools', () => {
  it('lists exactly the six read-only tools', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(
      ['cocktail_history', 'get_recipe', 'list_bottles', 'search_recipes', 'suggestion_history', 'whats_makeable'],
    );
    expect(tools.every(t => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it('list_bottles returns only my active bottles by default', async () => {
    const client = await connect();
    const out = await call(client, 'list_bottles');
    expect(out.bottles.map((b: Row) => b.name)).toEqual(['Hendricks']);

    const all = await call(client, 'list_bottles', { include_inactive: true });
    expect(all.bottles.map((b: Row) => b.name).sort()).toEqual(['Hendricks', 'Old Campari']);
  });

  it('search_recipes covers canonical + mine, never another user\'s custom recipes', async () => {
    const client = await connect();
    const out = await call(client, 'search_recipes');
    expect(out.recipes.map((r: Row) => r.name).sort()).toEqual(['My Negroni', 'Negroni']);

    const sour = await call(client, 'search_recipes', { query: 'secret' });
    expect(sour.count).toBe(0);

    const mine = await call(client, 'search_recipes', { source: 'mine' });
    expect(mine.recipes).toEqual([expect.objectContaining({ name: 'My Negroni', custom: true })]);

    const byAlias = await call(client, 'search_recipes', { query: 'house' });
    expect(byAlias.recipes.map((r: Row) => r.name)).toEqual(['My Negroni']);

    const byTag = await call(client, 'search_recipes', { tag: 'bitter' });
    expect(byTag.recipes.map((r: Row) => r.name)).toEqual(['Negroni']);
  });

  it('get_recipe prefers my custom recipe on a shared slug and hides other users\' recipes', async () => {
    const client = await connect();
    expect((await call(client, 'get_recipe', { slug: 'negroni' })).name).toBe('My Negroni');
    await expect(call(client, 'get_recipe', { slug: 'secret-sour' })).rejects.toThrow(/No recipe/);
  });

  it('get_recipe returns ingredients without internal fields', async () => {
    fixtures.recipes = fixtures.recipes.filter(r => r.id !== 'r2');
    const client = await connect();
    const recipe = await call(client, 'get_recipe', { slug: 'negroni' });
    expect(recipe.custom).toBe(false);
    expect(recipe).not.toHaveProperty('user_id');
    expect(recipe.ingredients[0]).not.toHaveProperty('sort_order');
  });

  it('whats_makeable passes my user id and drops recipes I cannot see', async () => {
    const client = await connect();
    const exact = await call(client, 'whats_makeable');
    expect(rpcCalls).toEqual([{ fn: 'get_makeable_recipes', args: { p_user_id: ME } }]);
    expect(exact.recipes).toEqual([{ name: 'Negroni', slug: 'negroni', missing_count: 0, missing_ingredients: [] }]);

    const near = await call(client, 'whats_makeable', { max_missing: 1 });
    expect(near.recipes.map((r: Row) => r.name)).toEqual(['Negroni', 'My Negroni']);
  });

  it('cocktail_history returns my entries with bottle names, honoring since', async () => {
    const client = await connect();
    const out = await call(client, 'cocktail_history');
    expect(out.entries.map((e: Row) => e.recipe_name)).toEqual(['Negroni', 'Gimlet']);
    expect(out.entries[0].bottles_used).toEqual(['Hendricks']);

    const recent = await call(client, 'cocktail_history', { since: '2026-09-01' });
    expect(recent.entries.map((e: Row) => e.recipe_name)).toEqual(['Negroni']);
  });

  it('suggestion_history returns only my sessions', async () => {
    const client = await connect();
    const out = await call(client, 'suggestion_history');
    expect(out.count).toBe(1);
    expect(out.sessions[0].context_signals).toEqual({ mood: 'cozy' });
    expect(out.sessions[0].suggestions[0]).not.toHaveProperty('sort_order');
  });

  it('scopes every tool to the token owner (the other user sees only their data)', async () => {
    const client = await connect(OTHER_TOKEN);
    expect((await call(client, 'list_bottles')).bottles.map((b: Row) => b.name)).toEqual(['Their Rum']);
    expect((await call(client, 'cocktail_history')).entries.map((e: Row) => e.recipe_name)).toEqual(['Their Daiquiri']);
    expect((await call(client, 'search_recipes', { source: 'mine' })).recipes.map((r: Row) => r.name)).toEqual(['Secret Sour']);
    expect((await call(client, 'get_recipe', { slug: 'negroni' })).name).toBe('Negroni');
  });
});
