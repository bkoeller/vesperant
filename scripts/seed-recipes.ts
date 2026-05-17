/**
 * Idempotent recipe seeder.
 *
 * Upserts every recipe in src/features/recipes/seed-data.ts into the canonical
 * recipes table (user_id IS NULL). Safe to run repeatedly — re-runs replace
 * ingredients for an existing slug rather than duplicating them.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx scripts/seed-recipes.ts
 *
 * Use this after pulling the 60-recipe expansion tranche (or any future
 * additions to seed-data.ts) to push them into production.
 */

import { createClient } from '@supabase/supabase-js';
import { CANONICAL_RECIPES } from '../src/features/recipes/seed-data';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  let inserted = 0;
  let updated = 0;
  const failures: { slug: string; error: string }[] = [];

  for (const r of CANONICAL_RECIPES) {
    const { data: existing } = await supabase
      .from('recipes')
      .select('id')
      .eq('slug', r.slug)
      .is('user_id', null)
      .maybeSingle();

    const recipeRow = {
      user_id: null,
      name: r.name,
      slug: r.slug,
      aliases: r.aliases,
      description: r.description,
      history: r.history,
      method: r.method,
      glassware: r.glassware,
      garnish: r.garnish,
      tags: r.tags,
      iba_category: r.iba_category,
      source: 'seed',
    };

    let recipeId: string;
    if (existing) {
      const { error: updErr } = await supabase
        .from('recipes')
        .update(recipeRow)
        .eq('id', (existing as { id: string }).id);
      if (updErr) {
        failures.push({ slug: r.slug, error: `update: ${updErr.message}` });
        continue;
      }
      recipeId = (existing as { id: string }).id;
      updated++;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from('recipes')
        .insert(recipeRow)
        .select('id')
        .single();
      if (insErr || !ins) {
        failures.push({ slug: r.slug, error: `insert: ${insErr?.message ?? 'no row'}` });
        continue;
      }
      recipeId = (ins as { id: string }).id;
      inserted++;
    }

    // Replace ingredients (delete then insert) — keeps idempotency clean.
    const { error: delErr } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);
    if (delErr) {
      failures.push({ slug: r.slug, error: `clear ingredients: ${delErr.message}` });
      continue;
    }

    if (r.ingredients.length > 0) {
      const ingRows = r.ingredients.map((ing, i) => ({
        recipe_id: recipeId,
        ingredient_name: ing.ingredient_name,
        ingredient_category: ing.ingredient_category,
        quantity: ing.quantity,
        unit: ing.unit,
        role: ing.role,
        optional: ing.optional,
        sort_order: i,
        notes: ing.notes,
      }));
      const { error: ingErr } = await supabase.from('recipe_ingredients').insert(ingRows);
      if (ingErr) failures.push({ slug: r.slug, error: `ingredients: ${ingErr.message}` });
    }
  }

  console.log(`\nSeed complete.`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Failed:   ${failures.length}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.slug}: ${f.error}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
