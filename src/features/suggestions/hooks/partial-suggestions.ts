/**
 * Extract complete suggestion objects from a partially-streamed JSON buffer.
 *
 * Claude streams JSON like:
 *   {"suggestions": [ {...complete...}, {...complete...}, {...partial
 *
 * We walk the buffer, find the suggestions array, and emit each balanced
 * { ... } object once it closes. Partial trailing objects are skipped until
 * the next tick when more bytes arrive.
 *
 * The returned objects are raw (untyped) — pass each through the existing
 * normalizeSuggestion in useSuggestions.ts to get a SuggestionResult.
 */
export function extractCompleteSuggestionObjects(buffer: string): unknown[] {
  // Strip a leading ```json fence if Claude added one even though we asked it
  // not to.
  let work = buffer.trimStart();
  if (work.startsWith('```')) {
    work = work.replace(/^```(?:json)?\n?/, '');
  }

  // Locate the suggestions array. We accept either `"suggestions": [` or a
  // bare top-level array `[`.
  const sugIdx = work.indexOf('"suggestions"');
  let arrStart: number;
  if (sugIdx >= 0) {
    arrStart = work.indexOf('[', sugIdx);
  } else {
    arrStart = work.indexOf('[');
  }
  if (arrStart < 0) return [];

  const results: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let objStart = -1;

  for (let i = arrStart + 1; i < work.length; i++) {
    const c = work[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const objStr = work.slice(objStart, i + 1);
        try {
          results.push(JSON.parse(objStr));
        } catch {
          // Defensive — shouldn't happen for a balanced slice with our walker,
          // but skip rather than throw if it does.
        }
        objStart = -1;
      }
    } else if (c === ']' && depth === 0) {
      break;
    }
  }

  return results;
}
