import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Read-only MCP tools over one user's Vesperant data.
//
// SCOPING: the client passed in is the service role, which bypasses RLS, so
// every query below must restrict itself to `userId` explicitly:
//   - user-owned tables:  .eq('user_id', userId)
//   - recipes:            canonical (user_id IS NULL) or the user's own
// api/_lib/mcp-tools.test.ts pins each of these filters.

const RECIPE_SCOPE = (userId: string) => `user_id.is.null,user_id.eq.${userId}`;

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export const SERVER_INSTRUCTIONS = `Vesperant is a personal bar assistant. These tools read the signed-in user's own data:
their bottle inventory, the recipe library (shared canonical recipes plus their custom ones),
what they can make with their bottles, their cocktail log, and past "Tonight" suggestion sessions.
All tools are read-only.`;

export function createVesperantMcpServer(db: SupabaseClient, userId: string): McpServer {
  const server = new McpServer(
    { name: 'vesperant', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    'list_bottles',
    {
      title: 'List bottles',
      description: "The user's bottle inventory. Active bottles only unless include_inactive is true.",
      inputSchema: {
        include_inactive: z.boolean().optional().describe('Include bottles marked as finished/inactive'),
        category: z.string().optional().describe('Filter by category, e.g. gin, whisky, vermouth, liqueur'),
      },
      annotations: READ_ONLY,
    },
    async ({ include_inactive, category }) => {
      let q = db
        .from('bottles')
        .select('name, brand, category, subcategory, spirit_type, tags, abv, proof, price_tier, is_premium, active, notes')
        .eq('user_id', userId);
      if (!include_inactive) q = q.eq('active', true);
      if (category) q = q.eq('category', category.toLowerCase());
      const { data, error } = await q.order('category').order('name');
      if (error) return fail(error.message);
      return json({ count: data.length, bottles: data });
    },
  );

  server.registerTool(
    'search_recipes',
    {
      title: 'Search recipes',
      description: 'Search the recipe library (canonical recipes plus the user\'s custom ones) by name, alias, or tag. Returns summaries; use get_recipe for ingredients.',
      inputSchema: {
        query: z.string().optional().describe('Matches recipe names and aliases (case-insensitive substring)'),
        tag: z.string().optional().describe('Exact tag, e.g. classic, tiki, sour, bitter'),
        source: z.enum(['all', 'library', 'mine']).optional().describe("'mine' = the user's custom recipes only"),
        limit: z.number().int().min(1).max(500).optional().describe('Default 50'),
      },
      annotations: READ_ONLY,
    },
    async ({ query, tag, source = 'all', limit = 50 }) => {
      let q = db.from('recipes').select('name, slug, aliases, method, glassware, tags, user_id');
      if (source === 'mine') q = q.eq('user_id', userId);
      else if (source === 'library') q = q.is('user_id', null);
      else q = q.or(RECIPE_SCOPE(userId));
      const { data, error } = await q.order('name');
      if (error) return fail(error.message);

      const needle = query?.trim().toLowerCase();
      const matches = data.filter(r =>
        (!needle || r.name.toLowerCase().includes(needle) || (r.aliases ?? []).some((a: string) => a.toLowerCase().includes(needle)))
        && (!tag || (r.tags ?? []).includes(tag.toLowerCase())),
      );
      return json({
        count: matches.length,
        recipes: matches.slice(0, limit).map(({ user_id, ...r }) => ({ ...r, custom: user_id === userId })),
      });
    },
  );

  server.registerTool(
    'get_recipe',
    {
      title: 'Get recipe',
      description: 'Full recipe with ingredients, by slug (from search_recipes). Prefers the user\'s custom recipe if it shares a slug with a canonical one.',
      inputSchema: { slug: z.string().describe('Recipe slug, e.g. negroni') },
      annotations: READ_ONLY,
    },
    async ({ slug }) => {
      const { data, error } = await db
        .from('recipes')
        .select('name, slug, aliases, description, history, method, glassware, garnish, tags, iba_category, user_id, recipe_ingredients(ingredient_name, ingredient_category, quantity, unit, role, optional, notes, sort_order)')
        .eq('slug', slug)
        .or(RECIPE_SCOPE(userId))
        .order('sort_order', { referencedTable: 'recipe_ingredients' });
      if (error) return fail(error.message);
      const recipe = data.find(r => r.user_id === userId) ?? data[0];
      if (!recipe) return fail(`No recipe with slug "${slug}". Use search_recipes to find slugs.`);
      const { user_id, recipe_ingredients, ...rest } = recipe;
      return json({
        ...rest,
        custom: user_id === userId,
        ingredients: (recipe_ingredients ?? []).map(({ sort_order: _, ...i }) => i),
      });
    },
  );

  server.registerTool(
    'whats_makeable',
    {
      title: "What's makeable",
      description: 'Recipes the user can make with their active bottles, using the same matching as the app. max_missing allows near-misses.',
      inputSchema: {
        max_missing: z.number().int().min(0).max(3).optional().describe('Allow up to N missing required ingredients (default 0)'),
      },
      annotations: READ_ONLY,
    },
    async ({ max_missing = 0 }) => {
      // get_makeable_recipes is SECURITY INVOKER; under the service role it
      // spans every user's custom recipes, so intersect with what this user
      // can see.
      const [makeable, visible] = await Promise.all([
        db.rpc('get_makeable_recipes', { p_user_id: userId }),
        db.from('recipes').select('id, slug').or(RECIPE_SCOPE(userId)),
      ]);
      if (makeable.error) return fail(makeable.error.message);
      if (visible.error) return fail(visible.error.message);

      const slugById = new Map<string, string>(visible.data.map(r => [r.id, r.slug]));
      const rows = (makeable.data as { recipe_id: string; recipe_name: string; missing_count: number; missing_ingredients: string[] | null }[])
        .filter(r => slugById.has(r.recipe_id) && r.missing_count <= max_missing)
        .map(r => ({
          name: r.recipe_name,
          slug: slugById.get(r.recipe_id),
          missing_count: r.missing_count,
          missing_ingredients: r.missing_ingredients ?? [],
        }));
      return json({ count: rows.length, recipes: rows });
    },
  );

  server.registerTool(
    'cocktail_history',
    {
      title: 'Cocktail history',
      description: 'Cocktails the user has logged, newest first, with ratings, tasting notes, and the bottles used.',
      inputSchema: {
        since: z.string().optional().describe('ISO date; only entries logged on or after it'),
        limit: z.number().int().min(1).max(500).optional().describe('Default 50'),
      },
      annotations: READ_ONLY,
    },
    async ({ since, limit = 50 }) => {
      let q = db
        .from('cocktail_logs')
        .select('recipe_name, rating, tasting_notes, social_context, bottles_used, logged_at')
        .eq('user_id', userId);
      if (since) q = q.gte('logged_at', since);
      const [logs, bottles] = await Promise.all([
        q.order('logged_at', { ascending: false }).limit(limit),
        db.from('bottles').select('id, name').eq('user_id', userId),
      ]);
      if (logs.error) return fail(logs.error.message);
      if (bottles.error) return fail(bottles.error.message);

      const nameById = new Map<string, string>(bottles.data.map(b => [b.id, b.name]));
      return json({
        count: logs.data.length,
        entries: logs.data.map(l => ({
          ...l,
          bottles_used: (l.bottles_used ?? []).map((id: string) => nameById.get(id) ?? 'unknown bottle'),
        })),
      });
    },
  );

  server.registerTool(
    'suggestion_history',
    {
      title: 'Suggestion history',
      description: 'Past "Tonight" suggestion sessions, newest first: the context (weather, mood, occasion) and the three cocktails suggested.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('Number of sessions, default 10'),
      },
      annotations: READ_ONLY,
    },
    async ({ limit = 10 }) => {
      const { data, error } = await db
        .from('suggestion_sessions')
        .select('created_at, context_signals, suggestions(recipe_name, archetype, reasoning, selected, sort_order)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('sort_order', { referencedTable: 'suggestions' })
        .limit(limit);
      if (error) return fail(error.message);
      return json({
        count: data.length,
        sessions: data.map(s => ({
          ...s,
          suggestions: (s.suggestions ?? []).map(({ sort_order: _, ...rest }) => rest),
        })),
      });
    },
  );

  return server;
}
