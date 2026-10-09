import { test } from "node:test";
import assert from "node:assert/strict";
import { searchTaxonPages } from "../src/taxonSearch";
import type { Taxon } from "../src/domain";

test("taxon suggestions include higher-priority matches from later pages", async () => {
  const cursors: (string | null | undefined)[] = [];
  const taxon = (id: string, sortOrder: number): Taxon => ({
    id,
    scientificName: `Test species ${id}`,
    japaneseName: `テスト${id}`,
    sortOrder,
  });
  const results = await searchTaxonPages("ＴＥＳＴ", async (cursor) => {
    cursors.push(cursor);
    if (!cursor) return {
      items: Array.from({ length: 20 }, (_, i) => taxon(String(i), i + 10)),
      cursor: "later",
    };
    return { items: [taxon("priority", 0)], cursor: null };
  });
  assert.deepEqual(cursors, [undefined, "later"]);
  assert.equal(results.length, 20);
  assert.equal(results[0].id, "priority");
});
