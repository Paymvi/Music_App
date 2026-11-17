import test from "node:test";
import assert from "node:assert/strict";

import { extractTab, validateTabUrl } from "./ugPage.js";

// Synthetic fixture shaped like an Ultimate Guitar page (invented content, not a real song).
function fixturePage({ tab = {}, view = {} } = {}) {
  const store = {
    store: {
      page: {
        data: {
          tab: {
            id: 900001,
            song_name: "River Road",
            artist_name: "Fixture Band",
            type: "Chords",
            version: 2,
            rating: 4.84661,
            votes: 321,
            difficulty: "",
            tab_url: "https://tabs.ultimate-guitar.com/tab/fixture-band/river-road-chords-900001",
            tab_access_type: "public",
            ...tab,
          },
          tab_view: {
            wiki_tab: {
              content: "[Intro]\r\n[tab][ch]Em7[/ch]      [ch]G[/ch]\r\nWalking down the river road[/tab]\r\n\r\n[tab]e|---3---|\r\nB|---0---|[/tab]",
            },
            meta: { capo: 2, tonality: "F#m", tuning: { name: "Standard", value: "E A D G B E" } },
            ug_difficulty: "intermediate",
            blocked: false,
            ...view,
          },
        },
      },
    },
  };
  const encoded = JSON.stringify(store).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<html><body><div class="js-store" data-content="${encoded}"></div></body></html>`;
}

test("extracts text and metadata with alignment kept", () => {
  const tab = extractTab(fixturePage());

  assert.equal(tab.title, "River Road");
  assert.equal(tab.artist, "Fixture Band");
  assert.equal(tab.type, "Chords");
  assert.equal(tab.id, "900001");
  assert.equal(tab.tuning, "Standard");
  assert.equal(tab.capo, "Capo 2");
  assert.equal(tab.key, "F#m");
  assert.equal(tab.difficulty, "Intermediate");
  assert.equal(tab.rating, 4.8);
  assert.equal(tab.content, "[Intro]\nEm7      G\nWalking down the river road\n\ne|---3---|\nB|---0---|");
});

test("decodes HTML entities in content", () => {
  const tab = extractTab(fixturePage({ view: { wiki_tab: { content: "Am <b> & 'x' \"y\"" } } }));
  assert.equal(tab.content, "Am <b> & 'x' \"y\"");
});

test("refuses non-public, paid, blocked, and non-text arrangements", () => {
  for (const override of [
    { tab: { tab_access_type: "private" } },
    { tab: { marketing_type: "TabPro" } },
    { view: { blocked: true } },
    { tab: { type: "Pro" } },
  ]) {
    assert.throws(() => extractTab(fixturePage(override)), (error) => error.status === 422, JSON.stringify(override));
  }
});

test("reports a changed or challenge page instead of guessing", () => {
  assert.throws(() => extractTab("<html><title>Just a moment...</title></html>"), (error) => error.status === 502);
  assert.throws(() => extractTab('<div class="js-store" data-content="{bad"></div>'), (error) => error.status === 502);
  assert.throws(() => extractTab(fixturePage({ view: { wiki_tab: {} } })), (error) => error.status === 502);
});

test("only allows arrangement pages on tabs.ultimate-guitar.com", () => {
  assert.equal(
    validateTabUrl("https://www.ultimate-guitar.com/tab/fixture-band/river-road-chords-900001?x=1").normalizedUrl,
    "https://tabs.ultimate-guitar.com/tab/fixture-band/river-road-chords-900001"
  );

  for (const bad of [
    "https://www.ultimate-guitar.com/search.php?value=x",
    "https://tabs.ultimate-guitar.com/tab/../search.php",
    "https://tabs.ultimate-guitar.com/tab/%2e%2e/search.php",
    "https://tabs.ultimate-guitar.com/tab/a%20b/c-chords-1",
    "https://evil.example/tab/a/b-chords-1",
    "http://tabs.ultimate-guitar.com/tab/a/b-chords-1",
    "http://127.0.0.1:8787/api/health",
    "file:///etc/passwd",
    "",
  ]) {
    assert.throws(() => validateTabUrl(bad), (error) => error.status === 400, bad);
  }

  assert.throws(() => validateTabUrl("https://tabs.ultimate-guitar.com/tab/a/b-guitar-pro-1"), (error) => error.status === 422);
});
