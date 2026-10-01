// Name de-duplication for the recipe-promotion job. Canonical recipes are
// looked up by name and alias throughout the app (suggestion card links,
// off-library detection), so a promoted recipe must not reuse either.

export function nameKey(name: string): string {
  return name.toLowerCase().trim();
}

export type NameResolution =
  | { action: 'insert'; name: string; aliases: string[] }
  | { action: 'skip'; reason: string };

/**
 * Decide what name a promoted recipe gets.
 *
 * Claude sometimes canonicalizes a variant to its parent's name ("Rye
 * Whiskey Sour" -> "Whiskey Sour"). If the returned name is taken, fall back
 * to the candidate name the suggestion actually used; if that's taken too,
 * the recipe is a duplicate. Aliases already used elsewhere are dropped.
 *
 * `taken` holds lowercased canonical names and aliases.
 */
export function resolvePromotedName(
  recipe: { name: string; candidate_name: string; aliases?: string[] | null },
  taken: ReadonlySet<string>,
): NameResolution {
  let name: string | null = null;
  for (const option of [recipe.name, recipe.candidate_name]) {
    if (option?.trim() && !taken.has(nameKey(option))) {
      name = option.trim();
      break;
    }
  }
  if (!name) {
    return { action: 'skip', reason: `duplicate_of:${recipe.name} (name already in library)` };
  }

  const seen = new Set([nameKey(name)]);
  const aliases: string[] = [];
  for (const alias of recipe.aliases ?? []) {
    const key = nameKey(alias);
    if (!key || taken.has(key) || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias.trim());
  }
  return { action: 'insert', name, aliases };
}
