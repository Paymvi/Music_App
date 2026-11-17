import test from "node:test";
import assert from "node:assert/strict";

import {
  buildImportedSong,
  cleanPastedTab,
  findDuplicateImport,
  getUltimateGuitarSearchUrl,
  looksLikeHtml,
  parseUltimateGuitarUrl,
} from "./ultimateGuitar.js";

test("parses and normalizes arrangement URLs", () => {
  const parsed = parseUltimateGuitarUrl(
    "https://Tabs.Ultimate-Guitar.com/tab/oasis/wonderwall-chords-39144/?app=1#top"
  );

  assert.deepEqual(parsed, {
    normalizedUrl: "https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-39144",
    arrangementId: "39144",
    arrangementType: "Chords",
    unsupportedReason: "",
  });

  assert.equal(parseUltimateGuitarUrl("https://www.ultimate-guitar.com/tab/oasis/wonderwall-tabs-27596").normalizedUrl,
    "https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-tabs-27596");
  assert.equal(parseUltimateGuitarUrl("https://tabs.ultimate-guitar.com/tab/39144").arrangementId, "39144");
});

test("rejects non-Ultimate Guitar and unsafe URLs", () => {
  assert.equal(parseUltimateGuitarUrl("javascript:alert(1)"), null);
  assert.equal(parseUltimateGuitarUrl("http://tabs.ultimate-guitar.com/tab/a/b-chords-1"), null);
  assert.equal(parseUltimateGuitarUrl("https://ultimate-guitar.com.evil.example/tab/a/b-chords-1"), null);
  assert.equal(parseUltimateGuitarUrl("not a url"), null);
});

test("flags interactive, paid, and non-guitar arrangements", () => {
  for (const slug of ["song-guitar-pro-123", "song-power-123", "song-official-123", "song-bass-123"]) {
    const parsed = parseUltimateGuitarUrl(`https://tabs.ultimate-guitar.com/tab/artist/${slug}`);
    assert.ok(parsed.unsupportedReason, slug);
  }
});

test("cleans pasted text without disturbing alignment", () => {
  const pasted =
    "\r\n\r\n[Verse]\r\n   [ch]G[/ch]      [ch]D/F#[/ch]   \r\nWalking down the river" + String.fromCharCode(0xa0) + "the day\r\n[tab]e|---3---|\r\nB|---0---|[/tab]\r\n\r\n";

  assert.equal(
    cleanPastedTab(pasted),
    "[Verse]\n   G      D/F#\nWalking down the river the day\ne|---3---|\nB|---0---|"
  );
});

test("detects pasted page HTML", () => {
  assert.ok(looksLikeHtml('<div class="js-store">x</div>'));
  assert.ok(!looksLikeHtml("e|--<3>--| harmonic"));
});

test("finds duplicates by arrangement ID or normalized URL", () => {
  const parsed = parseUltimateGuitarUrl("https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-39144?x=1");
  const songs = [
    { id: "itunes-1", source: "itunes", title: "Wonderwall" },
    { id: "ug-39144", source: "ultimate-guitar", sourceArrangementId: "39144", sourceUrl: parsed.normalizedUrl },
  ];

  assert.equal(findDuplicateImport(songs, parsed).id, "ug-39144");

  const otherVersion = parseUltimateGuitarUrl("https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-64382");
  assert.equal(findDuplicateImport(songs, otherVersion), null);

  const noId = parseUltimateGuitarUrl("https://www.ultimate-guitar.com/some/page");
  const legacy = [{ id: "ug-x", source: "ultimate-guitar", sourceUrl: "https://www.ultimate-guitar.com/some/page/" }];
  assert.equal(findDuplicateImport(legacy, noId).id, "ug-x");
});

test("builds a library song with source metadata", () => {
  const parsed = parseUltimateGuitarUrl("https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-39144");
  const song = buildImportedSong(
    { title: " Wonderwall ", artist: "Oasis", tuning: "", capo: "Capo 2", difficulty: "", tab: "Em7  G\n" },
    parsed,
    new Date("2026-11-15T00:00:00Z")
  );

  assert.equal(song.id, "ug-39144");
  assert.equal(song.title, "Wonderwall");
  assert.equal(song.source, "ultimate-guitar");
  assert.equal(song.sourceArrangementType, "Chords");
  assert.equal(song.importedAt, "2026-11-15T00:00:00.000Z");
  assert.equal(song.tuning, "");
  assert.equal(song.tab, "Em7  G");
});

test("search URL encodes the query", () => {
  assert.equal(
    getUltimateGuitarSearchUrl(" AC/DC back in black "),
    "https://www.ultimate-guitar.com/search.php?search_type=title&value=AC%2FDC%20back%20in%20black"
  );
});
