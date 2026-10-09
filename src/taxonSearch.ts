import type { Taxon } from "./domain";

export async function searchTaxonPages(
  query: string,
  load: (cursor?: string | null) => Promise<{ items: Taxon[]; cursor: string | null }>,
) {
  const normalized = query.normalize("NFKC").toLowerCase().trim();
  const found = new Map<string, Taxon>();
  let cursor: string | null | undefined;
  do {
    const page = await load(cursor);
    for (const taxon of page.items) {
      if (`${taxon.japaneseName} ${taxon.scientificName}`
        .normalize("NFKC")
        .toLowerCase()
        .includes(normalized)) found.set(taxon.id, taxon);
    }
    cursor = page.cursor;
  } while (cursor);
  return [...found.values()]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 20);
}
