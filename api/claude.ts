import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const DAILY_REQUEST_LIMIT = Number(process.env.CLAUDE_DAILY_LIMIT ?? 100);

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server is missing Supabase configuration');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured (missing ANTHROPIC_API_KEY)' });
  }

  // ---- Auth: verify Supabase JWT ----
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const admin = getAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  const userId = userData.user.id;
  const email = userData.user.email;

  // ---- Allowlist re-check (defense in depth — signup hook is the primary gate) ----
  if (!email) {
    return res.status(403).json({ error: 'Account has no email' });
  }
  const { data: allowed } = await admin
    .from('allowed_emails')
    .select('email')
    .ilike('email', email)
    .eq('is_active', true)
    .maybeSingle();
  if (!allowed) {
    return res.status(403).json({ error: 'Access not granted' });
  }

  // ---- Soft daily cap ----
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: usageCount } = await admin
    .from('claude_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('called_at', since);

  if ((usageCount ?? 0) >= DAILY_REQUEST_LIMIT) {
    return res.status(429).json({
      error: `Daily request limit reached (${DAILY_REQUEST_LIMIT}). Try again tomorrow.`,
    });
  }

  // ---- Forward to Claude ----
  const { systemPrompt, userPrompt, messages, model } = req.body ?? {};
  const userMessages = messages ?? [{ role: 'user', content: userPrompt }];

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: userMessages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(anthropicRes.status).end(errText);
    }

    const data = (await anthropicRes.json()) as {
      content: { text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const content = data.content?.[0]?.text ?? '';

    // Best-effort usage logging — don't fail the request if this errors
    void admin.from('claude_usage').insert({
      user_id: userId,
      endpoint: messages ? 'vision' : 'text',
      input_tokens: data.usage?.input_tokens ?? null,
      output_tokens: data.usage?.output_tokens ?? null,
    });

    return res.status(200).json({ content });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
