import { test } from "node:test";
import assert from "node:assert/strict";
import { createSongId, getSongKey, mergeLibrary, migrateLibrary, readBackup } from "./library.js";

const song = (id, title, extra = {}) => ({ id, title, artist: "Artist", tab: `${title} tab`, ...extra });

test("backup import replaces songs with the same id and keeps all others", () => {
  const current = {
    savedSongs: [song("a", "Old A"), song("b", "B")],
    playlists: [{ id: "p1", name: "Practice", songIds: ["a"] }],
    progressBySongId: { a: { percent: 50 }, b: { percent: 10 } },
    transposeBySongId: { b: { semitones: 2, flats: null } },
  };
  const incoming = readBackup({
    savedSongs: [song("a", "New A"), song("c", "C")],
    playlists: [{ id: "p1", name: "Practice", songIds: ["a", "c"] }],
    progressBySongId: { a: { percent: 90 } },
    transposeBySongId: { c: { semitones: -1, flats: true } },
  });

  const merged = mergeLibrary(current, incoming);

  assert.deepEqual(merged.savedSongs.map((s) => [s.id, s.title]), [["a", "New A"], ["b", "B"], ["c", "C"]]);
  assert.deepEqual(merged.playlists.map((p) => [p.id, p.songIds]), [["p1", ["a", "c"]]]);
  assert.deepEqual(merged.progressBySongId, { a: { percent: 90 }, b: { percent: 10 } });
  assert.deepEqual(Object.keys(merged.transposeBySongId), ["b", "c"]);
});

test("old playlists with song copies become song keys, and orphan copies are kept", () => {
  const { savedSongs, playlists } = migrateLibrary(
    [song("a", "A")],
    [{ id: "p1", name: "Old", songs: [song("a", "A stale copy"), song("x", "Only in playlist"), song("a", "dup")] }]
  );

  assert.deepEqual(playlists[0].songIds, ["a", "x"]);
  // The library's own copy wins; a song only stored in the playlist is added to the library.
  assert.deepEqual(savedSongs.map((s) => [s.id, s.title]), [["a", "A"], ["x", "Only in playlist"]]);
  assert.equal(migrateLibrary([], [{ id: "p", name: "New", songIds: ["a"] }]).playlists[0].songIds[0], "a");
});

test("bad backup entries are skipped, plain song arrays are accepted", () => {
  assert.deepEqual(readBackup(null).savedSongs, []);
  assert.deepEqual(readBackup({ savedSongs: [null, "x", 3] }).savedSongs, []);
  const plain = readBackup([{ title: "Wonderwall", artist: "Oasis" }]);
  assert.equal(plain.savedSongs[0].id, "imported-wonderwall-oasis");
  assert.equal(plain.savedSongs[0].tuning, "Standard");
});

test("song keys and ids share one slug", () => {
  assert.equal(getSongKey({ id: "x1", title: "T" }), "x1");
  assert.equal(getSongKey({ title: "Don't Stop!", artist: "Fleetwood Mac" }), "don-t-stop-fleetwood-mac");
  assert.equal(createSongId({ title: "Don't Stop!", artist: "Fleetwood Mac" }, "itunes"), "itunes-don-t-stop-fleetwood-mac");
});
