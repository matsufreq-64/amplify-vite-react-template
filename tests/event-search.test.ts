import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesEvent, searchEventPages } from "../src/eventSearch";
import type { CollectingEvent } from "../src/domain";

const event: CollectingEvent = {
  id: "event",
  eventNumber: 2,
  localityJapaneseFull: "愛知県名古屋市",
  localityJapaneseShort: "名古屋",
  localityRomaji: "Nagoya-shi",
  localityRomaji_2: "Atsuta-ku",
  date: "2026-09-05",
  collector: "S. Matsubara",
  method: "",
  memo: "",
};
test("event search matches Japanese and romanized localities and combines dates", () => {
  assert.ok(matchesEvent(event, { locality: "名古屋", date: "" }));
  assert.ok(
    matchesEvent(event, { locality: " ＮＡＧＯＹＡ ", date: "2026-09-05" }),
  );
  assert.ok(matchesEvent(event, { locality: "Atsuta", date: "" }));
  assert.ok(matchesEvent(event, { locality: "", date: "2026-09-05" }));
  assert.equal(
    matchesEvent(event, { locality: "東京", date: "2026-09-05" }),
    false,
  );
  assert.equal(
    matchesEvent(event, { locality: "名古屋", date: "2026-09-06" }),
    false,
  );
});
test("search follows empty and nonmatching pages and deduplicates matching events", async () => {
  const cursors: (string | null | undefined)[] = [];
  const results = await searchEventPages(
    { locality: "名古屋", date: "" },
    async (cursor) => {
      cursors.push(cursor);
      if (!cursor) return { items: [], cursor: "next" };
      if (cursor === "next")
        return {
          items: [
            {
              ...event,
              localityJapaneseFull: "東京",
              localityJapaneseShort: "",
              localityRomaji: "",
            },
          ],
          cursor: "last",
        };
      return {
        items: [
          event,
          event,
          { ...event, id: "new", eventNumber: 3, date: "2026-09-06" },
        ],
        cursor: null,
      };
    },
  );
  assert.deepEqual(cursors, [undefined, "next", "last"]);
  assert.deepEqual(
    results.map((item) => item.eventNumber),
    [3, 2],
  );
});
