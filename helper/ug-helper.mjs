// Local Fretz helper: fetches ONE public Ultimate Guitar arrangement page when you ask for it.
// It never searches (robots.txt disallows /search.php), never retries a refusal, and never
// imitates a browser to get past bot protection. Run: npm run ug-helper
import http from "node:http";

import { HelperError, extractTab, validateTabUrl } from "./ugPage.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.UG_HELPER_PORT) || 8787;
const USER_AGENT = "Fretz-UG-Helper/0.1 (personal single-arrangement import)";
const TIMEOUT_MS = 15_000;
const MIN_GAP_MS = 3_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 2;
const CACHE_MS = 24 * 60 * 60 * 1000;

// shortcut: in-memory cache, lost on restart; fine for one person's occasional imports.
const cache = new Map();
let nextSlot = 0;

// Space upstream requests at least MIN_GAP_MS apart, even when several arrive at once.
async function waitTurn() {
  const slot = Math.max(Date.now(), nextSlot);
  nextSlot = slot + MIN_GAP_MS;
  await new Promise((resolve) => setTimeout(resolve, slot - Date.now()));
}

async function fetchPage(startUrl) {
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await waitTurn();

    let response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      });
    } catch (error) {
      throw new HelperError(504, `Could not reach Ultimate Guitar (${error.name === "TimeoutError" ? "timed out" : error.message}).`);
    }

    console.log(`[ug-helper] GET ${url} -> ${response.status}`);

    if (response.status >= 300 && response.status < 400) {
      // Redirects must stay on an allowed arrangement URL.
      url = validateTabUrl(new URL(response.headers.get("location") || "", url).href).normalizedUrl;
      continue;
    }

    if (response.status !== 200) {
      const challenge = response.headers.get("cf-mitigated") ? " (bot challenge)" : "";
      throw new HelperError(502, `Ultimate Guitar refused the request: HTTP ${response.status}${challenge}. Fretz does not retry or work around this.`);
    }

    if (Number(response.headers.get("content-length")) > MAX_BYTES) {
      throw new HelperError(502, "The Ultimate Guitar page was unexpectedly large.");
    }

    const html = await response.text();
    if (html.length > MAX_BYTES) throw new HelperError(502, "The Ultimate Guitar page was unexpectedly large.");
    return html;
  }

  throw new HelperError(502, "Too many redirects from Ultimate Guitar.");
}

async function getTab(rawUrl) {
  const { normalizedUrl } = validateTabUrl(rawUrl);
  const cached = cache.get(normalizedUrl);

  if (cached && Date.now() - cached.at < CACHE_MS) return { ...cached.tab, cached: true };

  const tab = extractTab(await fetchPage(normalizedUrl));
  // Never trust the page's own URL field blindly; fall back to the URL we fetched.
  const pageUrl = (() => {
    try {
      return validateTabUrl(tab.url).normalizedUrl;
    } catch {
      return normalizedUrl;
    }
  })();

  const result = { ...tab, url: pageUrl };
  cache.set(normalizedUrl, { at: Date.now(), tab: result });
  return { ...result, cached: false };
}

const ALLOWED_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ALLOWED_HOST = new RegExp(`^(localhost|127\\.0\\.0\\.1):${PORT}$`);

function send(response, status, body, origin) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    Vary: "Origin",
    ...(origin && { "Access-Control-Allow-Origin": origin }),
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  const allowedOrigin = origin && ALLOWED_ORIGIN.test(origin) ? origin : "";

  // Blocks other websites (and DNS-rebinding tricks) from using this helper through your browser.
  if ((origin && !allowedOrigin) || !ALLOWED_HOST.test(request.headers.host || "")) {
    send(response, 403, { error: "Forbidden origin." });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method !== "GET") {
    send(response, 405, { error: "Only GET is supported." }, allowedOrigin);
  } else if (url.pathname === "/api/health") {
    send(response, 200, { ok: true }, allowedOrigin);
  } else if (url.pathname === "/api/ug/tab") {
    try {
      send(response, 200, { tab: await getTab(url.searchParams.get("url")) }, allowedOrigin);
    } catch (error) {
      send(response, error.status || 500, { error: error.status ? error.message : "Unexpected helper error." }, allowedOrigin);
      if (!error.status) console.error(error);
    }
  } else {
    send(response, 404, { error: "Not found." }, allowedOrigin);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[ug-helper] listening on http://${HOST}:${PORT} (this computer only)`);
});
