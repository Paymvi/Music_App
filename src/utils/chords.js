// Shared chord-sheet parsing (styled tab view + chord diagrams) and guitar voicings.

// Root is case-sensitive so lyric words like "a" or "am" are not chords.
const CHORD_TOKEN =
  /^([A-G][#b]?)((?:maj|min|dim|aug|sus|add|M|m|[-+°øΔ]|[#b]?\d{1,2}|\((?:[#b]?\d{1,2},?)+\))*)(?:\/([A-G][#b]?))?$/;
const NO_CHORD = /^N\.?C\.?$/;

export function isChordToken(token) {
  const trimmed = token.trim();
  return CHORD_TOKEN.test(trimmed) || NO_CHORD.test(trimmed);
}

export function isChordLine(line) {
  const trimmedLine = line.trim();
  return Boolean(trimmedLine) && trimmedLine.split(/\s+/).every(isChordToken);
}

export function isSectionLine(line) {
  return /^\s*\[[^\]]+\]\s*$/.test(line);
}

export function isNoteLine(line) {
  return /^\s*\([^)]*\)\s*$/.test(line);
}

export function isTabLine(line) {
  return /^\s*[eBGDAE]\|/.test(line) || /^\s*[|/\-0-9hbp~x\s]+$/.test(line);
}

// Distinct chords in order of first appearance, classifying lines the same way the styled view does.
export function extractChords(tab) {
  const found = new Set();
  const add = (token) => {
    if (CHORD_TOKEN.test(token)) found.add(token);
  };

  for (const line of (tab || "").split("\n")) {
    if (!line.trim() || isNoteLine(line)) continue;

    if (isSectionLine(line)) {
      // A lone "[Am]" line is an inline chord, "[Intro]" is a heading.
      add(line.trim().slice(1, -1).trim());
    } else if (isChordLine(line)) {
      line.trim().split(/\s+/).forEach(add);
    } else if (!isTabLine(line)) {
      for (const match of line.matchAll(/\[([^\]]+)\]/g)) add(match[1].trim());
    }
  }

  return [...found];
}

// ---------- Chord names ----------

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pitchClass(note) {
  const offset = note[1] === "#" ? 1 : note[1] === "b" ? -1 : 0;
  return (LETTER_PC[note[0]] + offset + 12) % 12;
}

const QUALITY_ALIASES = {
  "": "", maj: "", M: "",
  m: "m", min: "m", "-": "m",
  7: "7",
  maj7: "maj7", M7: "maj7", Δ: "maj7", Δ7: "maj7",
  m7: "m7", min7: "m7", "-7": "m7",
  sus: "sus4", sus4: "sus4", sus2: "sus2",
  "7sus": "7sus4", "7sus4": "7sus4",
  dim: "dim", "°": "dim",
  dim7: "dim7", "°7": "dim7",
  m7b5: "m7b5", "m7(b5)": "m7b5", min7b5: "m7b5", ø: "m7b5", ø7: "m7b5",
  aug: "aug", "+": "aug",
  add9: "add9", add2: "add9",
  6: "6", 9: "9", 5: "5",
};

// Semitones above the root.
const INTERVALS = {
  "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  sus2: [0, 2, 7], sus4: [0, 5, 7], "7sus4": [0, 5, 7, 10],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8],
  add9: [0, 2, 4, 7], 6: [0, 4, 7, 9], 9: [0, 2, 4, 7, 10], 5: [0, 7],
};

// Returns { rootPc, quality, bassPc } or null. quality is null when recognized but not in the dataset.
export function parseChordName(name) {
  const match = CHORD_TOKEN.exec(name);
  if (!match) return null;
  const quality = QUALITY_ALIASES[match[2]];
  return {
    rootPc: pitchClass(match[1]),
    quality: quality === undefined ? null : quality,
    bassPc: match[3] ? pitchClass(match[3]) : null,
  };
}

// ---------- Voicings (standard tuning) ----------
// frets: low E → high e, null = muted, 0 = open. fingers: 0 = none, 1-4; null when not verified.

export const STANDARD_TUNING_PCS = [4, 9, 2, 7, 11, 4];

const X = null;
const v = (frets, fingers) => ({ frets, fingers });

// Common open/first-position shapes, keyed by sharp spelling.
const OPEN_VOICINGS = {
  C: v([X, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]),
  A: v([X, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]),
  G: v([3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]),
  E: v([0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]),
  D: v([X, X, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]),
  Am: v([X, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]),
  Em: v([0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]),
  Dm: v([X, X, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]),
  A7: v([X, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]),
  B7: v([X, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4]),
  C7: v([X, 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0]),
  D7: v([X, X, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]),
  E7: v([0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]),
  G7: v([3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]),
  Am7: v([X, 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0]),
  Em7: v([0, 2, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0]),
  Dm7: v([X, X, 0, 2, 1, 1], [0, 0, 0, 2, 1, 1]),
  Cmaj7: v([X, 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0]),
  Fmaj7: v([X, X, 3, 2, 1, 0], [0, 0, 3, 2, 1, 0]),
  Amaj7: v([X, 0, 2, 1, 2, 0], [0, 0, 2, 1, 3, 0]),
  Dmaj7: v([X, X, 0, 2, 2, 2], [0, 0, 0, 1, 1, 1]),
  Gmaj7: v([3, 2, 0, 0, 0, 2], [3, 2, 0, 0, 0, 1]),
  Asus2: v([X, 0, 2, 2, 0, 0], [0, 0, 1, 2, 0, 0]),
  Asus4: v([X, 0, 2, 2, 3, 0], [0, 0, 1, 2, 3, 0]),
  Dsus2: v([X, X, 0, 2, 3, 0], [0, 0, 0, 1, 3, 0]),
  Dsus4: v([X, X, 0, 2, 3, 3], [0, 0, 0, 1, 3, 4]),
  Esus4: v([0, 2, 2, 2, 0, 0], [0, 2, 3, 4, 0, 0]),
  Cadd9: v([X, 3, 2, 0, 3, 0], [0, 2, 1, 0, 3, 0]),
  E5: v([0, 2, 2, X, X, X], [0, 1, 2, 0, 0, 0]),
  A5: v([X, 0, 2, 2, X, X], [0, 0, 1, 1, 0, 0]),
  "C/G": v([3, 3, 2, 0, 1, 0], [4, 3, 2, 0, 1, 0]),
  "C/E": v([0, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]),
  "G/B": v([X, 2, 0, 0, 0, 3], [0, 1, 0, 0, 0, 3]),
  "Am/G": v([3, 0, 2, 2, 1, 0], [4, 0, 2, 3, 1, 0]),
  // Fretted with the thumb or varying fingers, so no finger numbers.
  "D/F#": v([2, X, 0, 2, 3, 2], null),
  "G/F#": v([2, X, 0, 0, 0, 3], null),
};

// Movable barre shapes: offsets from the root fret r on the low E (string 0) or A (string 1) string.
const MOVABLE = {
  "": [[0, [0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1]], [1, [X, 0, 2, 2, 2, 0], [0, 1, 2, 3, 4, 1]]],
  m: [[0, [0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1]], [1, [X, 0, 2, 2, 1, 0], [0, 1, 3, 4, 2, 1]]],
  7: [[0, [0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1]], [1, [X, 0, 2, 0, 2, 0], [0, 1, 3, 1, 4, 1]]],
  m7: [[0, [0, 2, 0, 0, 0, 0], [1, 3, 1, 1, 1, 1]], [1, [X, 0, 2, 0, 1, 0], [0, 1, 3, 1, 2, 1]]],
  maj7: [[0, [0, X, 1, 1, 0, X], [2, 0, 3, 4, 1, 0]], [1, [X, 0, 2, 1, 2, 0], [0, 1, 3, 2, 4, 1]]],
  sus2: [[1, [X, 0, 2, 2, 0, 0], [0, 1, 3, 4, 1, 1]]],
  sus4: [[0, [0, 2, 2, 2, 0, 0], [1, 2, 3, 4, 1, 1]], [1, [X, 0, 2, 2, 3, 0], [0, 1, 2, 3, 4, 1]]],
  "7sus4": [[0, [0, 2, 0, 2, 0, 0], [1, 3, 1, 4, 1, 1]], [1, [X, 0, 2, 0, 3, 0], [0, 1, 3, 1, 4, 1]]],
  dim: [[1, [X, 0, 1, 2, 1, X], [0, 1, 2, 4, 3, 0]]],
  dim7: [[1, [X, 0, 1, -1, 1, X], [0, 2, 3, 1, 4, 0]]],
  m7b5: [[1, [X, 0, 1, 0, 1, X], [0, 1, 3, 2, 4, 0]]],
  aug: [[0, [0, X, 2, 1, 1, X], [1, 0, 4, 2, 3, 0]]],
  add9: [[1, [X, 0, 2, 4, 2, X], [0, 1, 2, 4, 3, 0]]],
  6: [[1, [X, 0, 2, 2, 2, 2], [0, 1, 3, 3, 3, 3]]],
  9: [[1, [X, 0, -1, 0, 0, 0], [0, 2, 1, 3, 3, 3]]],
  5: [[0, [0, 2, 2, X, X, X], [1, 3, 4, 0, 0, 0]], [1, [X, 0, 2, 2, X, X], [0, 1, 3, 4, 0, 0]]],
};

function movableVoicings(rootPc, quality) {
  const voicings = [];
  for (const [rootString, offsets, fingers] of MOVABLE[quality] || []) {
    const r = (rootPc - STANDARD_TUNING_PCS[rootString] + 12) % 12 || 12;
    for (const base of [r, r + 12]) {
      const frets = offsets.map((offset) => (offset === X ? X : base + offset));
      if (frets.every((fret) => fret === X || fret >= 1)) {
        voicings.push(v(frets, fingers));
        break;
      }
    }
  }
  return voicings.sort((a, b) => Math.max(...a.frets) - Math.max(...b.frets));
}

export function soundingPitchClasses(frets) {
  return frets.flatMap((fret, string) =>
    fret === X ? [] : [(STANDARD_TUNING_PCS[string] + fret) % 12]
  );
}

// True when the voicing plays exactly this chord with the right bass note.
// The perfect fifth may be left out of four-or-more-note chords, as in open C7.
export function isVoicingCorrect(frets, rootPc, quality, bassPc = null) {
  const sounding = soundingPitchClasses(frets);
  if (sounding.length < 3 && quality !== "5") return false;
  const required = INTERVALS[quality].map((interval) => (rootPc + interval) % 12);
  const allowed = new Set(bassPc === null ? required : [...required, bassPc]);
  const optional = required.length >= 4 ? (rootPc + 7) % 12 : null;

  return (
    sounding[0] === (bassPc ?? rootPc) &&
    sounding.every((pc) => allowed.has(pc)) &&
    required.every((pc) => pc === optional || sounding.includes(pc))
  );
}

// A root-position voicing turned into a slash chord: mute strings below the bass note,
// or add an open string just below the voicing that is the bass note.
function slashFrom({ frets, fingers }, bassPc) {
  const lowest = frets.findIndex((fret) => fret !== X);
  const fromString = frets.findIndex(
    (fret, string) => fret !== X && (STANDARD_TUNING_PCS[string] + fret) % 12 === bassPc
  );
  if (lowest > 0 && STANDARD_TUNING_PCS[lowest - 1] === bassPc) {
    return v(frets.with(lowest - 1, 0), fingers);
  }
  if (fromString >= 0 && frets.length - fromString >= 4) {
    return v(
      frets.map((fret, string) => (string >= fromString ? fret : X)),
      fingers && fingers.map((finger, string) => (string >= fromString ? finger : 0))
    );
  }
  return null;
}

// Returns a verified standard-tuning voicing for a chord name, or null when none is available.
export function getChordVoicing(name) {
  const chord = parseChordName(name);
  if (!chord || chord.quality === null) return null;
  const { rootPc, quality, bassPc } = chord;
  const baseName = SHARP_NAMES[rootPc] + quality;
  const exact = OPEN_VOICINGS[bassPc === null ? baseName : `${baseName}/${SHARP_NAMES[bassPc]}`];
  const rootPosition = [OPEN_VOICINGS[baseName], ...movableVoicings(rootPc, quality)].filter(Boolean);
  const candidates =
    bassPc === null || bassPc === rootPc
      ? [exact, ...rootPosition]
      : [exact, ...rootPosition.map((voicing) => slashFrom(voicing, bassPc))];

  // Runtime guard: never show a diagram whose notes don't match the chord name.
  return (
    candidates.find(
      (voicing) =>
        voicing && isVoicingCorrect(voicing.frets, rootPc, quality, bassPc === rootPc ? null : bassPc)
    ) || null
  );
}

// Treats blank as standard: most imports leave tuning empty when it is standard.
export function isStandardTuning(tuning) {
  const compact = (tuning || "").toLowerCase().replace(/[\s,()-]/g, "");
  return compact === "" || /^(standard|std)?(eadgbe)?$/.test(compact);
}

const STRING_NAMES = ["low E", "A", "D", "G", "B", "high e"];

export function describeVoicing(name, { frets, fingers }) {
  const parts = frets.map((fret, string) => {
    if (fret === X) return `${STRING_NAMES[string]} muted`;
    if (fret === 0) return `${STRING_NAMES[string]} open`;
    const finger = fingers?.[string] ? `, finger ${fingers[string]}` : "";
    return `${STRING_NAMES[string]} fret ${fret}${finger}`;
  });
  return `${name} chord diagram: ${parts.join("; ")}`;
}
