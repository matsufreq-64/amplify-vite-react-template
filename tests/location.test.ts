import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchMapDetails } from "../src/api/location";

test("map lookup preserves the place when elevation is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input).includes("getelevation.php"))
      return new Response(null, { status: 503 });
    return Response.json({
      response: {
        location: [{
          prefecture: "愛知県",
          city: "名古屋市熱田区",
          city_kana: "なごやしあつたく",
          town: "田町",
          town_kana: "たまちょう",
          postal: "",
          x: "136.8495",
          y: "35.0781",
          distance: 0,
        }],
      },
    });
  };
  try {
    const result = await fetchMapDetails(35.0781, 136.8495);
    assert.equal(result.altitude.status, "rejected");
    assert.equal(result.place.status, "fulfilled");
    if (result.place.status === "fulfilled")
      assert.equal(result.place.value.placeName, "愛知県名古屋市熱田区田町");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("map lookup preserves elevation when the place is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).includes("getelevation.php")
      ? Response.json({ elevation: 42.7 })
      : new Response(null, { status: 503 });
  try {
    const result = await fetchMapDetails(35.0781, 136.8495);
    assert.equal(result.altitude.status, "fulfilled");
    if (result.altitude.status === "fulfilled")
      assert.equal(result.altitude.value, 42.7);
    assert.equal(result.place.status, "rejected");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
