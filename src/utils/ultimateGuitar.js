// Ultimate Guitar has no public API and its site sends no CORS headers, so Fretz
// never fetches from it. These helpers only handle links and text the user pastes.

export const UG_SOURCE = "ultimate-guitar";
export const UG_SOURCE_NAME = "Ultimate Guitar";

const SUPPORTED_TYPES = { chords: "Chords", tabs: "Tab" };

const UNSUPPORTED_TYPES = {
  "guitar-pro": "Guitar Pro arrangements are interactive files, not text.",
  power: "Power Tab arrangements are interactive files, not text.",
  official: "Official tabs are paid Ultimate Guitar content.",
  pro: "Pro arrangements are interactive files, not text.",
  video: "Video lessons have no text to import.",
  bass: "Fretz imports guitar Chords and Tab arrangements only.",
  ukulele: "Fretz imports guitar Chords and Tab arrangements only.",
  drums: "Fretz imports guitar Chords and Tab arrangements only.",
};

export function getUltimateGuitarSearchUrl(query) {
  return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(
    query.trim()
  )}`;
}

// Returns null when the URL is not an https Ultimate Guitar URL.
export function parseUltimateGuitarUrl(rawUrl) {
  let url;

  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const isUgHost = host === "ultimate-guitar.com" || host.endsWith(".ultimate-guitar.com");

  if (url.protocol !== "https:" || !isUgHost) return null;

  const path = url.pathname.toLowerCase().replace(/\/+$/, "");
  const canonicalHost = path.startsWith("/tab/") ? "tabs.ultimate-guitar.com" : host;
  const lastSegment = path.split("/").pop() || "";

  // Slugs look like "wonderwall-chords-39144" or "song-guitar-pro-123"; short links are "/tab/39144".
  const idMatch = lastSegment.match(/(?:^|-)(\d+)$/);
  const typeMatch = lastSegment.match(/-(guitar-pro|chords|tabs|bass|ukulele|power|official|pro|video|drums)-\d+$/);
  const typeKey = typeMatch?.[1] || "";

  return {
    normalizedUrl: `https://${canonicalHost}${path}`,
    arrangementId: path.startsWith("/tab/") && idMatch ? idMatch[1] : "",
    arrangementType: SUPPORTED_TYPES[typeKey] || "",
    unsupportedReason: UNSUPPORTED_TYPES[typeKey] || "",
  };
}

// Browsers often copy non-breaking spaces, and pages can contain zero-width characters.
const NBSP = String.fromCharCode(0xa0);
const INVISIBLE_CHARS = new RegExp(
  [0x200b, 0x200c, 0x200d, 0xfeff].map((code) => String.fromCharCode(code)).join("|"),
  "g"
);

// Converts text copied from Ultimate Guitar into Fretz's plain-text tab format.
export function cleanPastedTab(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replaceAll(NBSP, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(/\[ch\]([^[]*?)\[\/ch\]/gi, "$1")
    .replace(/\[\/?tab\]/gi, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/^(\s*\n)+/, "")
    .trimEnd();
}

export function looksLikeHtml(text) {
  return /<\/?(html|head|body|div|span|script|style|p|br|pre|a)\b[^>]*>/i.test(text);
}

export function findDuplicateImport(songs, parsedUrl) {
  if (!parsedUrl) return null;

  return (
    songs.find((song) => {
      if (song.source !== UG_SOURCE) return false;

      if (parsedUrl.arrangementId && song.sourceArrangementId) {
        return song.sourceArrangementId === parsedUrl.arrangementId;
      }

      return parseUltimateGuitarUrl(song.sourceUrl)?.normalizedUrl === parsedUrl.normalizedUrl;
    }) || null
  );
}

export function buildImportedSong(form, parsedUrl, now = new Date()) {
  const random = Math.random().toString(16).slice(2, 8);

  return {
    id: parsedUrl.arrangementId
      ? `ug-${parsedUrl.arrangementId}`
      : `ug-${now.getTime()}-${random}`,
    title: form.title.trim(),
    artist: form.artist.trim(),
    // Blank means "not supplied by the source"; the viewer hides empty fields.
    tuning: form.tuning.trim(),
    capo: form.capo.trim(),
    difficulty: form.difficulty.trim(),
    // Only the key the source reports; Fretz never guesses one.
    key: (form.key || "").trim(),
    tab: cleanPastedTab(form.tab),
    imageUrl: "",
    addedAt: now.toISOString(),
    playlists: [],
    pinned: false,
    fontSizePx: 14,
    source: UG_SOURCE,
    sourceName: UG_SOURCE_NAME,
    sourceUrl: parsedUrl.normalizedUrl,
    sourceArrangementId: parsedUrl.arrangementId,
    sourceArrangementType: parsedUrl.arrangementType,
    importedAt: now.toISOString(),
  };
}
