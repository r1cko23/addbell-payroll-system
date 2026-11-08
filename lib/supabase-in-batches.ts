// One GET with ~650 UUIDs in `in.(...)` exceeds the Supabase gateway URL limit (400). See docs/GOTCHAS.md #1.
export const IN_FILTER_BATCH_SIZE = 100;

/** Runs `fetchBatch` on ≤100 ids at a time and joins the rows; the first error wins. */
export async function selectInBatches<T>(
  ids: string[],
  fetchBatch: (ids: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_FILTER_BATCH_SIZE) {
    batches.push(ids.slice(i, i + IN_FILTER_BATCH_SIZE));
  }
  const results = await Promise.all(batches.map((batch) => fetchBatch(batch)));
  const failed = results.find((result) => result.error);
  if (failed?.error) return { data: [], error: failed.error };
  return { data: results.flatMap((result) => result.data ?? []), error: null };
}
