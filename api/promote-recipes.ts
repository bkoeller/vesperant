import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildPromotionSystemPrompt, buildPromotionUserPrompt } from '../src/lib/prompts';

// Promotes off-library cocktail names from the suggestions table into the
// canonical recipes table. Invoked two ways:
//   1. Vercel Cron (weekly) with Authorization: Bearer <CRON_SECRET>
//   2. Manual admin trigger from Settings with the user's Supabase JWT
//
// In both cases the actual writes use the service role (canonical recipes
// have user_id = NULL which the RLS policies prohibit for authenticated).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Cap each Claude call to a reasonable batch so the function stays under
// Vercel's serverless timeout and Claude's max_tokens for output. 25 names
// per call keeps the response under ~3500 tokens of JSON in practice.
const PROMOTION_BATCH_SIZE = 25;

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server is missing Supabase configuration');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface PromotionResponse {
  recipes: {
    name: string;
    candidate_name: string;
    slug: string;
    aliases: string[];
    description: string;
    history: string;
    method: string;
    glassware: string;
    garnish: string;
    tags: string[];
    iba_category: string | null;
    ingredients: {
      ingredient_name: string;
      ingredient_category: string;
      quantity: number;
      unit: string;
      role: string;
      optional: boolean;
      notes: string | null;
    }[];
  }[];
  excluded: { candidate_name: string; reason: string }[];
}

function parsePromotion(raw: string): PromotionResponse {
  let s = raw.trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(s);
  return {
    recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
    excluded: Array.isArray(parsed.excluded) ? parsed.excluded : [],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured (missing ANTHROPIC_API_KEY)' });
  }

  const admin = getAdminClient();

  // ---- Auth: either CRON_SECRET (cron) or a logged-in admin's JWT (manual) ----
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let invoker: 'cron' | 'admin' = 'cron';

  if (CRON_SECRET && token === CRON_SECRET) {
    invoker = 'cron';
  } else if (token) {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (!profile || !(profile as { is_admin: boolean }).is_admin) {
      return res.status(403).json({ error: 'Admin only' });
    }
    invoker = 'admin';
  } else {
    return res.status(401).json({ error: 'Missing credentials' });
  }

  const dryRun = req.method === 'POST'
    ? Boolean((req.body as { dryRun?: boolean } | undefined)?.dryRun)
    : req.query?.dryRun === 'true';

  try {
    // ---- 1. Find candidate names ----
    // Off-library = suggestion.recipe_name where no canonical recipe (user_id IS NULL)
    // matches by lowercased name or lowercased alias. We compare case-insensitively
    // on the client side because PostgREST OR-with-aliases is awkward.
    const [{ data: sugRows, error: sugErr }, { data: canonicalRows, error: canErr }] = await Promise.all([
      admin.from('suggestions').select('recipe_name'),
      admin.from('recipes').select('name, aliases').is('user_id', null),
    ]);
    if (sugErr) throw sugErr;
    if (canErr) throw canErr;

    const canonicalNames = new Set<string>();
    for (const r of (canonicalRows ?? []) as { name: string; aliases: string[] | null }[]) {
      canonicalNames.add(r.name.toLowerCase().trim());
      for (const a of r.aliases ?? []) canonicalNames.add(a.toLowerCase().trim());
    }

    // Count occurrences so we promote popular missing names first.
    const counts = new Map<string, { display: string; count: number }>();
    for (const s of (sugRows ?? []) as { recipe_name: string }[]) {
      const key = s.recipe_name.toLowerCase().trim();
      if (canonicalNames.has(key)) continue;
      const existing = counts.get(key);
      if (existing) existing.count++;
      else counts.set(key, { display: s.recipe_name, count: 1 });
    }

    // Sort by frequency, then alpha. Take the first batch.
    const candidates = Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
      .slice(0, PROMOTION_BATCH_SIZE)
      .map(c => c.display);

    if (candidates.length === 0) {
      return res.status(200).json({
        invoker,
        dryRun,
        candidates: [],
        promoted: 0,
        excluded: 0,
        message: 'No off-library suggestions found.',
      });
    }

    if (dryRun) {
      return res.status(200).json({
        invoker,
        dryRun: true,
        candidates,
        candidateCount: candidates.length,
        offLibraryTotal: counts.size,
      });
    }

    // ---- 2. Ask Claude to canonicalize ----
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: buildPromotionSystemPrompt(),
        messages: [{ role: 'user', content: buildPromotionUserPrompt(candidates) }],
      }),
    });
    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(anthropicRes.status).json({ error: 'Claude error', detail: errText });
    }
    const claudeData = (await anthropicRes.json()) as {
      content: { text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const content = claudeData.content?.[0]?.text ?? '';

    // Best-effort usage logging — record under a synthetic system user_id of
    // the first admin if invoked by cron (so the row has a valid FK).
    if (invoker === 'cron') {
      const { data: firstAdmin } = await admin
        .from('profiles')
        .select('id')
        .eq('is_admin', true)
        .limit(1)
        .maybeSingle();
      if (firstAdmin) {
        void admin.from('claude_usage').insert({
          user_id: (firstAdmin as { id: string }).id,
          endpoint: 'promotion-cron',
          input_tokens: claudeData.usage?.input_tokens ?? null,
          output_tokens: claudeData.usage?.output_tokens ?? null,
        });
      }
    }

    const promotion = parsePromotion(content);

    // ---- 3. Insert canonical recipes (skip slugs that already exist) ----
    const { data: existingSlugs } = await admin
      .from('recipes')
      .select('slug')
      .is('user_id', null);
    const takenSlugs = new Set((existingSlugs ?? []).map((r: { slug: string }) => r.slug));

    let promoted = 0;
    const failures: { name: string; error: string }[] = [];

    for (const r of promotion.recipes) {
      // Skip if slug collides with an existing canonical recipe — that means
      // Claude returned something we already have under a different name.
      if (takenSlugs.has(r.slug)) {
        promotion.excluded.push({
          candidate_name: r.candidate_name,
          reason: `duplicate_of:${r.name} (slug already in library)`,
        });
        continue;
      }

      const { data: inserted, error: recErr } = await admin
        .from('recipes')
        .insert({
          user_id: null,
          name: r.name,
          slug: r.slug,
          aliases: r.aliases ?? [],
          description: r.description,
          history: r.history,
          method: r.method,
          glassware: r.glassware,
          garnish: r.garnish,
          tags: r.tags ?? [],
          iba_category: r.iba_category,
          source: 'promoted-from-suggestions',
        })
        .select('id')
        .single();

      if (recErr || !inserted) {
        failures.push({ name: r.name, error: recErr?.message ?? 'no row returned' });
        continue;
      }

      const recipeId = (inserted as { id: string }).id;
      const ingRows = (r.ingredients ?? []).map((ing, i) => ({
        recipe_id: recipeId,
        ingredient_name: ing.ingredient_name,
        ingredient_category: ing.ingredient_category,
        quantity: ing.quantity,
        unit: ing.unit,
        role: ing.role,
        optional: ing.optional ?? false,
        sort_order: i,
        notes: ing.notes ?? null,
      }));
      if (ingRows.length > 0) {
        const { error: ingErr } = await admin.from('recipe_ingredients').insert(ingRows);
        if (ingErr) {
          // Roll back the recipe so we don't leave an orphan
          await admin.from('recipes').delete().eq('id', recipeId);
          failures.push({ name: r.name, error: `ingredients: ${ingErr.message}` });
          continue;
        }
      }

      takenSlugs.add(r.slug);
      promoted++;
    }

    return res.status(200).json({
      invoker,
      dryRun: false,
      candidates: candidates.length,
      promoted,
      excluded: promotion.excluded,
      failures,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
