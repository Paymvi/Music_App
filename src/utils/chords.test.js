import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractChords,
  getChordVoicing,
  isChordToken,
  isStandardTuning,
  isVoicingCorrect,
  parseChordName,
  describeVoicing,
} from "./chords.js";
import { MOCK_SONGS } from "../data/mockSongs.js";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const QUALITIES = ["", "m", "7", "maj7", "m7", "sus2", "sus4", "7sus4", "dim", "dim7", "m7b5", "aug", "add9", "6", "9", "5"];

test("extracts chord-line and inline chords once, in order", () => {
  const tab = `
[Intro]
G D/F# Em C
[Verse 1]
[Am]Hello [C]world, [G]again
(Let ring)
e|-----3-----|
B|---1-------|
Am a song about a day
G D/F# Em C
[Chorus]
[F#m7b5]
N.C.
`;
  assert.deepEqual(extractChords(tab), ["G", "D/F#", "Em", "C", "Am", "F#m7b5"]);
});

test("ignores section labels, lyrics and notes", () => {
  assert.deepEqual(extractChords("[Verse]\n[Pre-Chorus]\nA day in the life\n(Capo 2, play softly)\n[Bridge 2]"), []);
  assert.deepEqual(extractChords(""), []);
  assert.deepEqual(extractChords(undefined), []);
});

test("chord tokens: case-sensitive root, common suffixes", () => {
  for (const token of ["Bb", "C#m7", "Ebmaj7", "Dsus4", "Asus2", "G7sus4", "Bdim", "Caug", "C+", "Cadd9", "Am/G", "Bm7b5", "N.C."]) {
    assert.ok(isChordToken(token), token);
  }
  for (const token of ["a", "am", "Add", "Bad", "Intro", "Verse", "the"]) {
    assert.ok(!isChordToken(token), token);
  }
});

test("recognized but unsupported chords have no voicing", () => {
  assert.equal(parseChordName("Cmaj13").quality, null);
  assert.equal(getChordVoicing("Cmaj13"), null);
  assert.equal(getChordVoicing("Am/F#"), null); // non-chord-tone bass with no curated shape
});

test("every supported quality has a correct voicing for all 12 roots", () => {
  for (const [rootPc, root] of NOTES.entries()) {
    for (const quality of QUALITIES) {
      const voicing = getChordVoicing(root + quality);
      assert.ok(voicing, `${root}${quality} missing`);
      assert.ok(isVoicingCorrect(voicing.frets, rootPc, quality), `${root}${quality} wrong notes`);
      assertPlayable(root + quality, voicing);
    }
  }
});

test("open, barre, flat and slash shapes", () => {
  assert.deepEqual(getChordVoicing("C").frets, [null, 3, 2, 0, 1, 0]);
  assert.deepEqual(getChordVoicing("F").frets, [1, 3, 3, 2, 1, 1]);
  assert.deepEqual(getChordVoicing("Bm").frets, [null, 2, 4, 4, 3, 2]);
  assert.deepEqual(getChordVoicing("Db").frets, getChordVoicing("C#").frets);
  assert.deepEqual(getChordVoicing("D/F#").frets, [2, null, 0, 2, 3, 2]);
  assert.deepEqual(getChordVoicing("A/E").frets, [0, 0, 2, 2, 2, 0]); // open low E added
  assert.deepEqual(getChordVoicing("C/E").frets, [0, 3, 2, 0, 1, 0]);
});

test("slash chords always have the named bass note lowest", () => {
  for (const [rootPc, root] of NOTES.entries()) {
    for (const quality of ["", "m", "7"]) {
      for (const [bassPc, bass] of NOTES.entries()) {
        const voicing = getChordVoicing(`${root}${quality}/${bass}`);
        if (!voicing) continue;
        const bassOrNull = bassPc === rootPc ? null : bassPc;
        assert.ok(isVoicingCorrect(voicing.frets, rootPc, quality, bassOrNull), `${root}${quality}/${bass}`);
        assertPlayable(`${root}${quality}/${bass}`, voicing);
      }
    }
  }
});

test("every chord in the built-in songs is recognized", () => {
  for (const song of MOCK_SONGS) {
    for (const name of extractChords(song.tab)) assert.ok(parseChordName(name), `${song.title}: ${name}`);
  }
});

test("tuning detection", () => {
  for (const tuning of ["", "Standard", "standard", "E A D G B E", "Standard (E A D G B E)", undefined]) {
    assert.ok(isStandardTuning(tuning), String(tuning));
  }
  for (const tuning of ["Half-step down", "Drop D", "D A D G B E", "Open G"]) {
    assert.ok(!isStandardTuning(tuning), tuning);
  }
});

test("accessible description", () => {
  assert.equal(
    describeVoicing("D", getChordVoicing("D")),
    "D chord diagram: low E muted; A muted; D open; G fret 2, finger 1; B fret 3, finger 3; high e fret 2, finger 2"
  );
});

// Fingers must be physically sensible: one fret per finger, barres only over fretted strings at or above the barre.
function assertPlayable(name, { frets, fingers }) {
  const fretted = frets.filter((fret) => fret > 0);
  assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 4, `${name} stretch`);
  if (!fingers) return;
  const fretOfFinger = {};
  frets.forEach((fret, string) => {
    assert.equal(fingers[string] > 0, fret > 0, `${name} finger on string ${string}`);
    if (!fingers[string]) return;
    const finger = fingers[string];
    assert.ok(fretOfFinger[finger] === undefined || fretOfFinger[finger] === fret, `${name} finger ${finger} on two frets`);
    fretOfFinger[finger] = fret;
  });
  for (const [finger, fret] of Object.entries(fretOfFinger)) {
    const strings = fingers.flatMap((f, s) => (f === Number(finger) ? [s] : []));
    for (let s = strings[0]; s <= strings.at(-1); s++) {
      assert.ok(frets[s] >= fret, `${name} barre ${finger} crosses string ${s}`);
    }
  }
  for (const [a, fretA] of Object.entries(fretOfFinger)) {
    for (const [b, fretB] of Object.entries(fretOfFinger)) {
      if (fretA < fretB) assert.ok(Number(a) < Number(b), `${name} finger order ${a}/${b}`);
    }
  }
}
