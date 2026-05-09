import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock the Supabase client BEFORE the handler imports it. mockGetUser /
// mockAllowedSelect / mockUsageSelect / mockUsageInsert let each test stub
// individual collaborator behaviors without rebuilding the whole client.
const mockGetUser = vi.fn();
const mockAllowedMaybeSingle = vi.fn();
const mockUsageThen = vi.fn();
const mockUsageInsert = vi.fn();

function buildAllowedBuilder() {
  const builder = {
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mockAllowedMaybeSingle,
  };
  return builder;
}

function buildUsageSelectBuilder() {
  // Thenable so `await admin.from('claude_usage').select(...).eq(...).gte(...)`
  // resolves to `{ count }`.
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockImplementation(function gte(this: typeof builder) {
      return {
        then: (onFulfilled: (v: { count: number }) => unknown) =>
          mockUsageThen().then(onFulfilled),
      };
    }),
  };
  return builder;
}

function buildUsageInsertBuilder() {
  return { insert: mockUsageInsert };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'allowed_emails') return buildAllowedBuilder();
      if (table === 'claude_usage') {
        // Inserts and selects both go through from('claude_usage'); merge them.
        const select = buildUsageSelectBuilder();
        return {
          ...select,
          insert: mockUsageInsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

function makeRes() {
  const res: Partial<VercelResponse> & { _status: number; _body: unknown } = {
    _status: 0,
    _body: null,
  };
  res.status = vi.fn((s: number) => {
    res._status = s;
    return res as VercelResponse;
  });
  res.json = vi.fn((b: unknown) => {
    res._body = b;
    return res as VercelResponse;
  });
  res.end = vi.fn((b?: unknown) => {
    res._body = b ?? null;
    return res as VercelResponse;
  });
  return res as VercelResponse & { _status: number; _body: unknown };
}

function makeReq(opts: { method?: string; auth?: string; body?: unknown } = {}): VercelRequest {
  return {
    method: opts.method ?? 'POST',
    headers: { authorization: opts.auth ?? '' },
    body: opts.body ?? { systemPrompt: 'sys', userPrompt: 'hi' },
  } as unknown as VercelRequest;
}

async function loadHandler() {
  const mod = await import('./claude');
  return mod.default;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-jwt');
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
  vi.stubEnv('CLAUDE_DAILY_LIMIT', '100');
  vi.stubGlobal('fetch', vi.fn());

  mockGetUser.mockReset();
  mockAllowedMaybeSingle.mockReset();
  mockUsageThen.mockReset();
  mockUsageInsert.mockReset();

  // Sensible defaults for the happy-path collaborators
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-uuid', email: 'test@example.com' } },
    error: null,
  });
  mockAllowedMaybeSingle.mockResolvedValue({
    data: { email: 'test@example.com' },
    error: null,
  });
  mockUsageThen.mockResolvedValue({ count: 5 });
  mockUsageInsert.mockReturnValue(Promise.resolve({ error: null }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('/api/claude — auth gate', () => {
  it('returns 405 for non-POST requests', async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res);
    expect(res._status).toBe(405);
  });

  it('returns 500 when ANTHROPIC_API_KEY is unset', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ auth: 'Bearer x' }), res);
    expect(res._status).toBe(500);
    expect(res._body).toMatchObject({ error: expect.stringContaining('ANTHROPIC_API_KEY') });
  });

  it('returns 401 when no bearer token is provided', async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ auth: '' }), res);
    expect(res._status).toBe(401);
    expect(res._body).toMatchObject({ error: 'Missing bearer token' });
  });

  it('returns 401 when Supabase rejects the JWT', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired', status: 401 },
    });
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ auth: 'Bearer bad-token' }), res);
    expect(res._status).toBe(401);
    expect(res._body).toMatchObject({
      error: 'Invalid session',
      detail: 'JWT expired',
    });
  });

  it('returns 403 when the user is not on the allowlist', async () => {
    mockAllowedMaybeSingle.mockResolvedValue({ data: null, error: null });
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ auth: 'Bearer good-token' }), res);
    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({ error: 'Access not granted' });
  });

  it('returns 403 when the authenticated user has no email', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-uuid', email: null } },
      error: null,
    });
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ auth: 'Bearer good-token' }), res);
    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({ error: 'Account has no email' });
  });

  it('returns 429 when the user is over the daily request cap', async () => {
    mockUsageThen.mockResolvedValue({ count: 100 });
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ auth: 'Bearer good-token' }), res);
    expect(res._status).toBe(429);
    expect(res._body).toMatchObject({
      error: expect.stringContaining('Daily request limit'),
    });
  });

  it('forwards to Anthropic and returns 200 on the happy path', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: 'A perfect Negroni for tonight.' }],
        usage: { input_tokens: 120, output_tokens: 45 },
      }),
    });

    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ auth: 'Bearer good-token' }), res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ content: 'A perfect Negroni for tonight.' });

    // Sent the API key in the right header to Anthropic
    const [, init] = fetchMock.mock.calls[0];
    expect((init as { headers: Record<string, string> }).headers['x-api-key']).toBe('sk-ant-test');

    // Logged usage with token counts
    expect(mockUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-uuid',
        input_tokens: 120,
        output_tokens: 45,
      }),
    );
  });

  it('propagates Anthropic error status without leaking the API key', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 529,
      text: async () => 'Anthropic overloaded',
    });

    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ auth: 'Bearer good-token' }), res);

    expect(res._status).toBe(529);
    expect(String(res._body)).not.toContain('sk-ant-test');
  });
});
