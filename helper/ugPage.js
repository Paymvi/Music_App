// Pure helpers for the local Ultimate Guitar helper: URL allow-listing and page extraction.
import { cleanPastedTab, parseUltimateGuitarUrl } from "../src/utils/ultimateGuitar.js";

export const UPSTREAM_ORIGIN = "https://tabs.ultimate-guitar.com";

export class HelperError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Only single arrangement pages are fetchable; search and every other path are refused.
export function validateTabUrl(rawUrl) {
  const parsed = parseUltimateGuitarUrl(rawUrl);
  const path = parsed?.normalizedUrl.slice(UPSTREAM_ORIGIN.length) || "";

  if (!parsed || !parsed.normalizedUrl.startsWith(`${UPSTREAM_ORIGIN}/tab/`) || !/^\/tab\/[a-z0-9_\-/]+$/.test(path)) {
    throw new HelperError(400, "Only Ultimate Guitar arrangement links (tabs.ultimate-guitar.com/tab/…) can be fetched.");
  }

  if (parsed.unsupportedReason) throw new HelperError(422, parsed.unsupportedReason);

  return parsed;
}

function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Ultimate Guitar embeds page data as JSON in <div class="js-store" data-content="…">.
export function extractTab(html) {
  const match = html.match(/<div class="js-store" data-content="([^"]*)"/);

  if (!match) {
    throw new HelperError(502, "Ultimate Guitar did not return the expected page. The page layout may have changed.");
  }

  let store;
  try {
    store = JSON.parse(decodeEntities(match[1]));
  } catch {
    throw new HelperError(502, "Could not read the page data from Ultimate Guitar.");
  }

  const data = store?.store?.page?.data;
  const tab = data?.tab;
  const view = data?.tab_view;
  const content = view?.wiki_tab?.content;

  if (!tab || typeof content !== "string") {
    throw new HelperError(502, "This page has no text arrangement Fretz can read.");
  }

  if (tab.tab_access_type !== "public" || tab.marketing_type || view.blocked) {
    throw new HelperError(422, "This arrangement is not publicly available, so Fretz will not import it.");
  }

  if (tab.type !== "Chords" && tab.type !== "Tabs") {
    throw new HelperError(422, `${tab.type || "This"} arrangements are not text Chords or Tab, so Fretz cannot import them.`);
  }

  const meta = view.meta || {};
  const difficulty = typeof view.ug_difficulty === "string" ? view.ug_difficulty : tab.difficulty || "";

  return {
    id: String(tab.id),
    title: tab.song_name || "",
    artist: tab.artist_name || "",
    type: tab.type === "Tabs" ? "Tab" : "Chords",
    version: tab.version ?? null,
    rating: typeof tab.rating === "number" ? Math.round(tab.rating * 10) / 10 : null,
    votes: tab.votes ?? null,
    url: tab.tab_url || "",
    tuning: meta.tuning?.name || meta.tuning?.value || "",
    capo: meta.capo ? `Capo ${meta.capo}` : "",
    key: meta.tonality || "",
    difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
    content: cleanPastedTab(content),
  };
}
