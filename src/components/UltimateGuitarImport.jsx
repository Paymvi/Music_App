import { useRef, useState } from "react";
import { FiExternalLink, FiClipboard, FiX, FiCheck, FiDownload } from "react-icons/fi";

import {
  UG_SOURCE_NAME,
  buildImportedSong,
  cleanPastedTab,
  findDuplicateImport,
  getUltimateGuitarSearchUrl,
  looksLikeHtml,
  parseUltimateGuitarUrl,
} from "../utils/ultimateGuitar";

// Optional local helper (npm run ug-helper) that fetches one public arrangement page on request.
const HELPER_URL = import.meta.env.VITE_UG_HELPER_URL || "http://127.0.0.1:8787";

const EMPTY_FORM = {
  title: "",
  artist: "",
  sourceUrl: "",
  tuning: "",
  capo: "",
  difficulty: "",
  tab: "",
};

export default function UltimateGuitarImport({ savedSongs, onImport, onReplace, onOpenSong }) {
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicateSong, setDuplicateSong] = useState(null);
  const [lastImported, setLastImported] = useState(null);
  const [helperStatus, setHelperStatus] = useState("unknown");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedDetails, setFetchedDetails] = useState(null);
  const fetchIdRef = useRef(0);

  const parsedUrl = parseUltimateGuitarUrl(form.sourceUrl);
  const cleanedTab = cleanPastedTab(form.tab);
  const canFetch =
    parsedUrl && !parsedUrl.unsupportedReason && parsedUrl.normalizedUrl.includes("/tab/");

  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setFormError("");
    setDuplicateSong(null);
    if (field === "sourceUrl") {
      setFetchedDetails(null);
      fetchIdRef.current += 1;
    }
  }

  async function checkHelper() {
    try {
      const response = await fetch(`${HELPER_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
      setHelperStatus(response.ok ? "ready" : "offline");
    } catch {
      setHelperStatus("offline");
    }
  }

  async function handleFetchFromLink() {
    const requestedUrl = form.sourceUrl;
    const requestId = ++fetchIdRef.current;
    setIsFetching(true);
    setFormError("");

    try {
      let response;
      try {
        response = await fetch(
          `${HELPER_URL}/api/ug/tab?url=${encodeURIComponent(requestedUrl)}`,
          { signal: AbortSignal.timeout(30000) }
        );
      } catch {
        setHelperStatus("offline");
        throw new Error(
          "Couldn't reach the Fretz helper on this computer. Start it with \"npm run ug-helper\", or paste the text yourself."
        );
      }

      const body = await response.json().catch(() => ({}));
      setHelperStatus("ready");

      // Ignore the result if the link was edited or fetched again while it was loading.
      if (requestId !== fetchIdRef.current) return;
      if (!response.ok || !body.tab) throw new Error(body.error || `The helper answered HTTP ${response.status}.`);

      const tab = body.tab;
      setForm((currentForm) => ({
        ...currentForm,
        title: tab.title,
        artist: tab.artist,
        sourceUrl: tab.url,
        tuning: tab.tuning,
        capo: tab.capo,
        difficulty: tab.difficulty,
        tab: tab.content,
      }));
      setFetchedDetails(tab);
      setDuplicateSong(findDuplicateImport(savedSongs, parseUltimateGuitarUrl(tab.url)));
      setIsPreviewing(true);
    } catch (error) {
      if (requestId === fetchIdRef.current) setFormError(error.message);
    } finally {
      setIsFetching(false);
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;
    window.open(getUltimateGuitarSearchUrl(query), "_blank", "noopener,noreferrer");
  }

  // The draft is kept when the form is closed, so an accidental close doesn't lose pasted text.
  function openForm() {
    setIsPreviewing(false);
    setFormError("");
    setDuplicateSong(null);
    setIsFormOpen(true);
    checkHelper();
  }

  function closeForm() {
    setIsFormOpen(false);
  }

  function getValidationError() {
    if (!form.title.trim() || !form.artist.trim()) return "Song title and artist are required.";
    if (!parsedUrl) return "Paste the arrangement's ultimate-guitar.com link (it must start with https://).";
    if (parsedUrl.unsupportedReason) return `This arrangement can't be imported. ${parsedUrl.unsupportedReason}`;
    if (!cleanedTab) return "Paste the chords or tab text.";
    if (looksLikeHtml(cleanedTab)) return "This looks like webpage code. Copy the chords/tab text itself, not the page source.";
    return "";
  }

  function handlePreview(event) {
    event.preventDefault();

    const error = getValidationError();
    if (error) {
      setFormError(error);
      return;
    }

    setDuplicateSong(findDuplicateImport(savedSongs, parsedUrl));
    setIsPreviewing(true);
  }

  function handleImport() {
    const song = buildImportedSong(form, parsedUrl);
    onImport(song);
    setLastImported(song);
    setForm(EMPTY_FORM);
    setIsFormOpen(false);
  }

  function handleReplace() {
    const shouldReplace = window.confirm(
      `Replace the saved tab text of "${duplicateSong.title}" with this pasted version? Any edits you made to that tab will be lost. Its playlists, pin, and progress are kept.`
    );
    if (!shouldReplace) return;

    onReplace(duplicateSong, buildImportedSong(form, parsedUrl));
    setLastImported(duplicateSong);
    setForm(EMPTY_FORM);
    setIsFormOpen(false);
  }

  function handleOpenDuplicate() {
    onOpenSong(duplicateSong);
    setIsFormOpen(false);
  }

  // Version, rating and key are shown only when the helper supplied them.
  const fetched = fetchedDetails?.url === form.sourceUrl ? fetchedDetails : null;
  const previewMeta = [
    parsedUrl?.arrangementType,
    fetched?.version && `Version ${fetched.version}`,
    fetched?.rating && `★ ${fetched.rating}${fetched.votes ? ` (${fetched.votes.toLocaleString()} votes)` : ""}`,
    fetched?.key && `Key ${fetched.key}`,
    form.tuning.trim(),
    form.capo.trim(),
    form.difficulty.trim(),
  ].filter(Boolean);

  return (
    <section className="ug-panel" aria-labelledby="ug-heading">
      <h2 id="ug-heading">Find chords and tabs on Ultimate Guitar</h2>
      <p className="ug-note">
        Search opens ultimate-guitar.com in a new tab (Fretz can&apos;t search it for you). Copy an
        arrangement&apos;s link, press Paste, then Fetch text. Fetching needs the Fretz helper running on
        this computer; otherwise paste the text yourself.
      </p>

      <form className="ug-search-row" onSubmit={handleSearch} role="search">
        <input
          type="search"
          aria-label="Search Ultimate Guitar for a song or artist"
          placeholder="Song or artist"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <button type="submit" className="primary-button" disabled={!query.trim()}>
          <span>Search UG</span>
          <FiExternalLink aria-hidden="true" />
        </button>

        <button type="button" className="secondary-button" onClick={openForm}>
          <FiClipboard aria-hidden="true" />
          <span>Paste</span>
        </button>
      </form>

      {lastImported && (
        <div className="ug-success" role="status">
          <FiCheck aria-hidden="true" />
          <span>
            Saved &ldquo;{lastImported.title}&rdquo; to My Songs.
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onOpenSong(lastImported);
              setLastImported(null);
            }}
          >
            Open song
          </button>
          <button
            type="button"
            className="ug-dismiss"
            aria-label="Dismiss"
            onClick={() => setLastImported(null)}
          >
            <FiX />
          </button>
        </div>
      )}

      {isFormOpen && (
        <div className="modal-backdrop" onKeyDown={(event) => event.key === "Escape" && closeForm()}>
          <form
            className="edit-tab-modal"
            onSubmit={handlePreview}
            aria-labelledby="ug-form-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Paste from Ultimate Guitar</p>
                <h2 id="ug-form-title">
                  {isPreviewing ? "Preview before saving" : "Import an arrangement"}
                </h2>
              </div>

              <button type="button" className="modal-close-button" onClick={closeForm} aria-label="Close">
                <FiX />
              </button>
            </div>

            {isPreviewing ? (
              <>
                <div className="ug-preview-heading">
                  <h3>{form.title.trim()}</h3>
                  <p>{form.artist.trim()}</p>
                  {previewMeta.length > 0 && (
                    <div className="tab-meta">
                      {previewMeta.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  )}
                  <p className="ug-attribution">
                    Source:{" "}
                    <a href={parsedUrl.normalizedUrl} target="_blank" rel="noopener noreferrer">
                      {UG_SOURCE_NAME}
                    </a>
                    {parsedUrl.arrangementId && ` · arrangement ${parsedUrl.arrangementId}`}
                  </p>
                </div>

                <pre className="tab-content ug-preview-text">{cleanedTab}</pre>

                {duplicateSong && (
                  <div className="ug-duplicate" role="alert">
                    <p>
                      You already saved this arrangement as &ldquo;{duplicateSong.title}&rdquo;.
                    </p>
                    <div className="modal-actions">
                      <button type="button" className="secondary-button" onClick={handleOpenDuplicate}>
                        Open saved song
                      </button>
                      <button type="button" className="secondary-button danger-text" onClick={handleReplace}>
                        Replace its tab
                      </button>
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setIsPreviewing(false)}>
                    Back to edit
                  </button>
                  <button type="button" className="secondary-button" onClick={closeForm}>
                    Cancel
                  </button>
                  {!duplicateSong && (
                    <button type="button" className="primary-button" onClick={handleImport}>
                      Import to My Songs
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="form-grid two-column">
                  <label>
                    Song title
                    <input value={form.title} onChange={(event) => updateField("title", event.target.value)} />
                  </label>

                  <label>
                    Artist
                    <input value={form.artist} onChange={(event) => updateField("artist", event.target.value)} />
                  </label>
                </div>

                <label>
                  Ultimate Guitar link
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://tabs.ultimate-guitar.com/tab/..."
                    value={form.sourceUrl}
                    onChange={(event) => updateField("sourceUrl", event.target.value)}
                  />
                  {parsedUrl && (
                    <span className={parsedUrl.unsupportedReason ? "ug-url-hint warning" : "ug-url-hint"}>
                      {parsedUrl.unsupportedReason ||
                        [parsedUrl.arrangementType, parsedUrl.arrangementId && `ID ${parsedUrl.arrangementId}`]
                          .filter(Boolean)
                          .join(" · ") ||
                        "Ultimate Guitar link"}
                    </span>
                  )}
                </label>

                <div className="ug-fetch-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleFetchFromLink}
                    disabled={!canFetch || isFetching}
                  >
                    <FiDownload aria-hidden="true" />
                    <span>{isFetching ? "Fetching…" : "Fetch text"}</span>
                  </button>
                  <span className="ug-helper-status" role="status">
                    {helperStatus === "ready"
                      ? "Helper connected. Fetches this one public arrangement."
                      : helperStatus === "offline"
                        ? "Helper not running on this computer. Paste the text below instead."
                        : ""}
                  </span>
                </div>

                <div className="form-grid">
                  <label>
                    Tuning (optional)
                    <input
                      placeholder="E A D G B E"
                      value={form.tuning}
                      onChange={(event) => updateField("tuning", event.target.value)}
                    />
                  </label>

                  <label>
                    Capo (optional)
                    <input
                      placeholder="Capo 2"
                      value={form.capo}
                      onChange={(event) => updateField("capo", event.target.value)}
                    />
                  </label>

                  <label>
                    Difficulty (optional)
                    <input
                      placeholder="Beginner"
                      value={form.difficulty}
                      onChange={(event) => updateField("difficulty", event.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Chords or tab text
                  <textarea
                    className="ug-paste-area"
                    spellCheck="false"
                    placeholder={"Paste the arrangement text here.\n\n[Verse]\nEm7        G\nWalking down the river the day"}
                    value={form.tab}
                    onChange={(event) => updateField("tab", event.target.value)}
                  />
                </label>

                {formError && (
                  <p className="ug-error" role="alert">
                    {formError}
                  </p>
                )}

                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={closeForm}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button">
                    Preview
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
