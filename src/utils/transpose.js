// Chord transposition. Always derived from the original tab text, so offsets never accumulate.
import { CHORD_TOKEN, extractChords, isChordLine, isChordToken, isNoteLine, isTabLine, pitchClass } from "./chords.js";

export const MAX_TRANSPOSE = 12;

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
// Db, Eb, F, Ab, Bb majors (and their relative minors) are written with flats; F# is preferred over Gb.
const FLAT_MAJOR_PCS = new Set([1, 3, 5, 8, 10]);

const mod12 = (n) => ((n % 12) + 12) % 12;
const spell = (pc, flats) => (flats ? FLATS : SHARPS)[mod12(pc)];

// Moves the root and slash bass; the quality/extension text is kept exactly as written.
export function transposeChord(name, semitones, flats = false) {
  const match = CHORD_TOKEN.exec(name);
  if (!match || mod12(semitones) === 0) return name;
  const [, root, suffix, bass] = match;
  const shift = (note) => spell(pitchClass(note) + semitones, flats);
  return shift(root) + suffix + (bass ? `/${shift(bass)}` : "");
}

// Accepts "C", "Am", "F#m", "Bb major", "D minor". Anything else is treated as unknown.
export function parseKey(key) {
  const match = /^([A-G][#b]?)\s*(.*)$/.exec((key || "").trim());
  if (!match) return null;
  const minor = /^(m|min|minor)$/i.test(match[2]);
  if (!minor && !/^(maj|major)?$/i.test(match[2])) return null;
  return { pc: pitchClass(match[1]), minor };
}

// { original, transposed, flats } for a known key, otherwise null (the key is never guessed).
export function getKeyInfo(key, semitones) {
  const parsed = parseKey(key);
  if (!parsed) return null;
  const pc = mod12(parsed.pc + semitones);
  const flats = FLAT_MAJOR_PCS.has(parsed.minor ? mod12(pc + 3) : pc);
  const original = key.trim();
  const transposed = mod12(semitones) === 0 ? original : spell(pc, flats) + (parsed.minor ? "m" : "");
  return { original, transposed, flats };
}

// Default spelling when the key is unknown: follow whichever accidental the sheet already uses more.
export function prefersFlats(tab) {
  let balance = 0;
  for (const chord of extractChords(tab)) {
    const [, root, , bass] = CHORD_TOKEN.exec(chord);
    for (const note of [root, bass]) {
      if (note?.[1] === "b") balance += 1;
      if (note?.[1] === "#") balance -= 1;
    }
  }
  return balance > 0;
}

// Keeps later chords above the same lyric column: growth is taken out of the following gap
// (leaving at least one space) and shrinkage is padded back.
function transposeChordLine(line, shift) {
  let drift = 0;
  return line
    .split(/(\s+)/)
    .map((piece, index) => {
      if (!piece) return piece;
      if (/^\s+$/.test(piece)) {
        const length = Math.max(index === 0 ? 0 : 1, piece.length - drift);
        drift += length - piece.length;
        return length <= piece.length ? piece.slice(0, length) : piece + " ".repeat(length - piece.length);
      }
      const out = isChordToken(piece) ? shift(piece) : piece;
      drift += out.length - piece.length;
      return out;
    })
    .join("");
}

// Same line classification as the styled view (SongTab), so only rendered chords change.
export function transposeTab(tab, semitones, flats = false) {
  if (!tab || mod12(semitones) === 0) return tab;
  const shift = (chord) => transposeChord(chord.trim(), semitones, flats);

  return tab
    .split("\n")
    .map((line) => {
      if (!line.trim() || isNoteLine(line)) return line;
      if (isChordLine(line)) return transposeChordLine(line, shift);
      if (isTabLine(line)) return line;
      // Section headings, lyrics and (notes) pass through; only [Chord] brackets change.
      return line
        .split(/(\[[^\]]+\]|\([^)]*\))/g)
        .map((piece) => {
          if (!/^\[[^\]]+\]$/.test(piece)) return piece;
          const inside = piece.slice(1, -1);
          return isChordToken(inside) ? `[${inside.replace(inside.trim(), shift(inside))}]` : piece;
        })
        .join("");
    })
    .join("\n");
}

// ---------- Per-song preference (localStorage, keyed by song id) ----------

const STORAGE_KEY = "fretzTranspose";
const DEFAULT = { semitones: 0, flats: null };

export function clampSemitones(value) {
  return Math.max(-MAX_TRANSPOSE, Math.min(MAX_TRANSPOSE, Math.round(Number(value)) || 0));
}

export function loadTranspose(songId, storage) {
  if (!songId) return DEFAULT;
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(STORAGE_KEY))?.[songId];
    if (!saved) return DEFAULT;
    return {
      semitones: clampSemitones(saved.semitones),
      flats: typeof saved.flats === "boolean" ? saved.flats : null,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveTranspose(songId, { semitones, flats }, storage) {
  if (!songId) return;
  try {
    const store = storage ?? globalThis.localStorage;
    const all = JSON.parse(store.getItem(STORAGE_KEY)) || {};
    if (semitones === 0 && flats === null) delete all[songId];
    else all[songId] = { semitones, flats };
    store.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Preference just won't persist (e.g. storage blocked).
  }
}
