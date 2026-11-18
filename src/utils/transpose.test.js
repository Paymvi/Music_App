import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampSemitones,
  getKeyInfo,
  loadTranspose,
  prefersFlats,
  saveTranspose,
  transposeChord,
  transposeTab,
} from "./transpose.js";
import { extractChords } from "./chords.js";
import { MOCK_SONGS } from "../data/mockSongs.js";

test("positive and negative offsets with octave wraparound", () => {
  assert.equal(transposeChord("C", 2), "D");
  assert.equal(transposeChord("C", -2), "A#");
  assert.equal(transposeChord("C", -2, true), "Bb");
  assert.equal(transposeChord("B", 1), "C");
  assert.equal(transposeChord("A", 5), "D");
  assert.equal(transposeChord("C", 12), "C");
  assert.equal(transposeChord("C", -12), "C");
  assert.equal(transposeChord("G", 7), transposeChord("G", -5));
});

test("sharp and flat roots", () => {
  assert.equal(transposeChord("F#", 1), "G");
  assert.equal(transposeChord("Bb", 2), "C");
  assert.equal(transposeChord("Bb", 1), "B");
  assert.equal(transposeChord("Eb", 2, true), "F");
  assert.equal(transposeChord("Db", 1, false), "D");
  assert.equal(transposeChord("F#", -1, true), "F");
  assert.equal(transposeChord("C#m", 1, true), "Dm");
});

test("chord qualities, extensions and parentheses are kept", () => {
  const cases = {
    Am: "Bm", Cmaj7: "Dmaj7", Dm7: "Em7", G7: "A7", "F#m7b5": "G#m7b5",
    Cadd9: "Dadd9", Asus4: "Bsus4", "G7(b9)": "A7(b9)", "Bbm6": "Cm6", "E7(#9)": "F#7(#9)",
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(transposeChord(from, 2), to, from);
});

test("slash chords move both root and bass", () => {
  assert.equal(transposeChord("C/E", 2), "D/F#");
  assert.equal(transposeChord("C/E", 2, true), "D/Gb");
  assert.equal(transposeChord("G/B", -2, true), "F/A");
  assert.equal(transposeChord("Am7/G", 3), "Cm7/A#");
});

test("non-chords are left alone", () => {
  assert.equal(transposeChord("N.C.", 3), "N.C.");
  assert.equal(transposeChord("Intro", 3), "Intro");
});

const SHEET = `[Intro]
G   D/F#  Em  C
[Verse 1]
   C          G/B
Walking down a long and winding road
[Am]Hello [C]world, (let it ring [G]) [Chorus 2]
(Play softly)
e|-----3-----|
A day in the life
N.C.  F#m7b5`;

test("chord sheets: only chords change; lyrics, headings, notes and tabs stay", () => {
  const out = transposeTab(SHEET, 2).split("\n");
  const original = SHEET.split("\n");
  assert.equal(out[0], "[Intro]");
  assert.equal(out[1], "A   E/G#  F#m D");
  assert.equal(out[2], "[Verse 1]");
  assert.equal(out[3], "   D          A/C#");
  assert.equal(out[4], original[4]);
  // Brackets inside a (note) are rendered as note text, so they are not transposed.
  assert.equal(out[5], "[Bm]Hello [D]world, (let it ring [G]) [Chorus 2]");
  for (const index of [6, 7, 8]) assert.equal(out[index], original[index]);
  assert.equal(out[9], "N.C.  G#m7b5");
});

test("chord-line columns stay aligned when names change length", () => {
  // Chord starts at columns 0 and 6 are kept; a gap never drops below one space.
  assert.equal(transposeTab("C     G", 1), "C#    G#");
  assert.equal(transposeTab("C# G#", 1), "D  A");
  assert.equal(transposeTab("C G", 1), "C# G#");
});

test("lone bracketed chord line and section line", () => {
  assert.equal(transposeTab("[Am]", 3), "[Cm]");
  assert.equal(transposeTab("[ Am ]", 3), "[ Cm ]");
  assert.equal(transposeTab("[Bridge]", 3), "[Bridge]");
});

test("zero offset and reset return the exact original text", () => {
  for (const song of MOCK_SONGS) {
    assert.equal(transposeTab(song.tab, 0), song.tab);
    assert.equal(transposeTab(song.tab, 12), song.tab);
    assert.equal(transposeTab(song.tab, -12), song.tab);
  }
  assert.equal(transposeTab(undefined, 3), undefined);
});

test("repeated slider moves derive from the original, never accumulate", () => {
  for (const song of MOCK_SONGS) {
    let shown;
    for (const offset of [1, 2, 3, -5, 7, 12, -1, 3]) shown = transposeTab(song.tab, offset);
    assert.equal(shown, transposeTab(song.tab, 3));
    // Every extracted chord moves the same distance.
    const before = extractChords(song.tab).map((c) => transposeChord(c, 3));
    assert.deepEqual(extractChords(shown), [...new Set(before)]);
  }
});

test("key info: shown only when the key is known, with key-appropriate spelling", () => {
  assert.equal(getKeyInfo("", 2), null);
  assert.equal(getKeyInfo(undefined, 2), null);
  assert.equal(getKeyInfo("Dorian-ish", 2), null);
  assert.deepEqual(getKeyInfo("C", 0), { original: "C", transposed: "C", flats: false });
  assert.deepEqual(getKeyInfo("C", 5), { original: "C", transposed: "F", flats: true });
  assert.deepEqual(getKeyInfo("G", -2), { original: "G", transposed: "F", flats: true });
  assert.deepEqual(getKeyInfo("Am", 5), { original: "Am", transposed: "Dm", flats: true });
  assert.deepEqual(getKeyInfo("Em", 2), { original: "Em", transposed: "F#m", flats: false });
  assert.equal(getKeyInfo("C", 1).transposed, "Db");
  assert.equal(getKeyInfo("C", 6).transposed, "F#");
  assert.equal(getKeyInfo("Bb major", 2).transposed, "C");
  assert.equal(getKeyInfo("D minor", 0).transposed, "D minor");
});

test("default spelling follows the sheet's own accidentals", () => {
  assert.equal(prefersFlats("Bb Eb F"), true);
  assert.equal(prefersFlats("F# C#m D"), false);
  assert.equal(prefersFlats("G C D"), false);
});

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)), data };
}

test("per-song preference persists by song id", () => {
  const storage = fakeStorage();
  assert.deepEqual(loadTranspose("song-a", storage), { semitones: 0, flats: null });

  saveTranspose("song-a", { semitones: 3, flats: true }, storage);
  saveTranspose("song-b", { semitones: -2, flats: null }, storage);
  assert.deepEqual(loadTranspose("song-a", storage), { semitones: 3, flats: true });
  assert.deepEqual(loadTranspose("song-b", storage), { semitones: -2, flats: null });
  assert.deepEqual(loadTranspose("song-c", storage), { semitones: 0, flats: null });

  // Resetting a song removes its entry rather than storing a default.
  saveTranspose("song-b", { semitones: 0, flats: null }, storage);
  assert.deepEqual(Object.keys(JSON.parse(storage.data.fretzTranspose)), ["song-a"]);

  // No id: nothing is stored.
  saveTranspose(undefined, { semitones: 4, flats: null }, storage);
  assert.deepEqual(loadTranspose(undefined, storage), { semitones: 0, flats: null });
});

test("bad stored values fall back safely", () => {
  const storage = fakeStorage({ fretzTranspose: JSON.stringify({ x: { semitones: 99, flats: "yes" }, y: { semitones: "abc" } }) });
  assert.deepEqual(loadTranspose("x", storage), { semitones: 12, flats: null });
  assert.deepEqual(loadTranspose("y", storage), { semitones: 0, flats: null });
  assert.deepEqual(loadTranspose("x", fakeStorage({ fretzTranspose: "{not json" })), { semitones: 0, flats: null });
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(loadTranspose("x", throwing), { semitones: 0, flats: null });
  assert.doesNotThrow(() => saveTranspose("x", { semitones: 1, flats: null }, throwing));
  assert.equal(clampSemitones("-3"), -3);
  assert.equal(clampSemitones(-40), -12);
});
