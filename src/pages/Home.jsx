import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAlbumArt } from "../api/albumArt";
import { searchSongs } from "../api/songSearch";

import {
  FiSearch,
  FiPlus,
  FiMusic,
  FiX,
  FiMoreVertical,
  FiImage,
  FiTrash2,
  FiEye,
  FiEdit3,
  FiList,
  FiStar,
  FiTrendingUp,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";

import SongTab from "../components/SongTab";
import UltimateGuitarImport from "../components/UltimateGuitarImport";
import { MOCK_SONGS } from "../data/mockSongs";
import { createSongId, getSongKey, mergeLibrary, migrateLibrary, readBackup } from "../utils/library";
import { readJson, writeJson } from "../utils/storage";
import { TRANSPOSE_STORAGE_KEY, saveTranspose } from "../utils/transpose";

const asArray = (value) => (Array.isArray(value) ? value : []);

// Read once at startup; also converts playlists saved with full song copies to song keys.
function loadLibrary() {
  return migrateLibrary(asArray(readJson("savedSongs", [])), asArray(readJson("playlists", [])));
}

const songTitleKey = (song) => `${song.title}|${song.artist}`.toLowerCase();

export default function Home() {
  const [query, setQuery] = useState("");
  const [showSavedCount, setShowSavedCount] = useState(true);

  const [libraryTab, setLibraryTab] = useState("songs");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

  const [newSongForm, setNewSongForm] = useState({
    title: "",
    artist: "",
    tuning: "Standard",
    difficulty: "Beginner",
    capo: "No capo",
    tab: "",
    fontSizePx: 14,
  });

  const importFileInputRef = useRef(null);

  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingSongs, setIsSearchingSongs] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);

  const [albumArtBySongId, setAlbumArtBySongId] = useState({});

  const [initialLibrary] = useState(loadLibrary);
  const [savedSongs, setSavedSongs] = useState(initialLibrary.savedSongs);

  const [selectedSong, setSelectedSong] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [editingSong, setEditingSong] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    artist: "",
    tuning: "",
    difficulty: "",
    capo: "",
    tab: "",
    fontSizePx: 14,
  });

  const [playlistSong, setPlaylistSong] = useState(null);
  const [playlistName, setPlaylistName] = useState("");

  const [playlists, setPlaylists] = useState(initialLibrary.playlists);

  const [progressBySongId, setProgressBySongId] = useState(() => {
    const storedProgress = readJson("songProgress", {});
    return typeof storedProgress === "object" && !Array.isArray(storedProgress) ? storedProgress : {};
  });

  const [expandedProgressNotes, setExpandedProgressNotes] = useState({});


  useEffect(() => {
    writeJson("savedSongs", savedSongs);
  }, [savedSongs]);

  useEffect(() => {
    writeJson("playlists", playlists);
  }, [playlists]);

  function updateQuery(value) {
    setQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      setSearchError("");
    }
  }

  useEffect(() => {
    if (!query.trim()) return;

    const controller = new AbortController();

    async function runSongSearch() {
      const normalizedQuery = query.toLowerCase();
      const hardcodedResults = MOCK_SONGS.filter(
        (song) =>
          song.title.toLowerCase().includes(normalizedQuery) ||
          song.artist.toLowerCase().includes(normalizedQuery)
      ).map((song) => ({ ...song, source: "hardcoded", fontSizePx: song.fontSizePx || 14 }));

      try {
        setIsSearchingSongs(true);
        setSearchError("");

        const apiResults = await searchSongs(query, {
          signal: controller.signal,
        });

        // iTunes ids never match built-in ids, so compare by title and artist.
        const hardcodedKeys = new Set(hardcodedResults.map(songTitleKey));

        const uniqueApiResults = apiResults.filter(
          (song) => !hardcodedKeys.has(songTitleKey(song))
        );

        setSearchResults([...hardcodedResults, ...uniqueApiResults]);
      } catch (error) {
        if (error.name === "AbortError") return;

        console.error(error);

        setSearchResults(hardcodedResults);

        if (hardcodedResults.length === 0) {
          setSearchError("Could not search songs right now.");
        }
      } finally {
        setIsSearchingSongs(false);
      }
    }

    const timeoutId = setTimeout(runSongSearch, 350);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (searchResults.length === 0) return;

    let isCancelled = false;

    async function loadAlbumArtForSearchResults() {
      // Misses are stored as "" too, so each song is looked up once, not on every re-run.
      const songsMissingArt = searchResults.filter(
        (song) => !(song.id in albumArtBySongId)
      );

      if (songsMissingArt.length === 0) return;

      const results = await Promise.allSettled(
        songsMissingArt.map(async (song) => {
          const imageUrl = await fetchAlbumArt(song.title, song.artist);

          return { imageUrl };
        })
      );

      if (isCancelled) return;

      setAlbumArtBySongId((currentArt) => {
        const updatedArt = { ...currentArt };

        results.forEach((result, index) => {
          updatedArt[songsMissingArt[index].id] =
            result.status === "fulfilled" ? result.value.imageUrl : "";
        });

        return updatedArt;
      });
    }

    loadAlbumArtForSearchResults();

    return () => {
      isCancelled = true;
    };
  }, [searchResults, albumArtBySongId]);

  useEffect(() => {
    writeJson("songProgress", progressBySongId);
  }, [progressBySongId]);







  function handleDeleteAllSongs() {
    const shouldDelete = window.confirm(
      "Delete all saved songs, playlists, progress, and the currently opened tab? This cannot be undone."
    );

    if (!shouldDelete) return;

    setSavedSongs([]);
    setPlaylists([]);
    setSelectedSong(null);
    setProgressBySongId({});
    writeJson(TRANSPOSE_STORAGE_KEY, {});
    setExpandedProgressNotes({});
    setOpenMenuId(null);
  }



  function getBackupFileName() {
    const date = new Date().toISOString().slice(0, 10);
    return `fretz-backup-${date}.json`;
  }

  function handleExportSongs() {
    const backupData = {
      appName: "Fretz",
      version: 2,
      exportedAt: new Date().toISOString(),
      savedSongs,
      playlists,
      progressBySongId,
      transposeBySongId: readJson(TRANSPOSE_STORAGE_KEY, {}),
    };

    const json = JSON.stringify(backupData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = getBackupFileName();
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    URL.revokeObjectURL(url);
  }

  function handleImportButtonClick() {
    importFileInputRef.current?.click();
  }

  async function handleImportSongs(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const incoming = readBackup(data);
      const songCount = incoming.savedSongs.length;
      const playlistCount = incoming.playlists.length;

      if (songCount === 0 && playlistCount === 0) {
        alert("This file does not contain any Fretz songs or playlists.");
        return;
      }

      const shouldImport = window.confirm(
        `Import ${songCount} song${songCount === 1 ? "" : "s"} and ${playlistCount} playlist${playlistCount === 1 ? "" : "s"}?\n\nSongs with the same ID will be updated.`
      );

      if (!shouldImport) return;

      const merged = mergeLibrary(
        {
          savedSongs,
          playlists,
          progressBySongId,
          transposeBySongId: readJson(TRANSPOSE_STORAGE_KEY, {}),
        },
        incoming
      );

      setSavedSongs(merged.savedSongs);
      setPlaylists(merged.playlists);
      setProgressBySongId(merged.progressBySongId);
      writeJson(TRANSPOSE_STORAGE_KEY, merged.transposeBySongId);

      alert("Import complete!");
    } catch (error) {
      console.error("Import failed:", error);
      alert("Could not import this file. Make sure it is a valid Fretz JSON backup.");
    } finally {
      event.target.value = "";
    }
  }



  function getProgressEntry(song) {
    const songKey = getSongKey(song);

    return (
      progressBySongId[songKey] || {
        percent: 0,
        notes: "",
        trackedAt: "",
        updatedAt: "",
      }
    );
  }

  function handleTrackProgress(song) {
    const songKey = getSongKey(song);

    setProgressBySongId((currentProgress) => ({
      ...currentProgress,
      [songKey]: currentProgress[songKey] || {
        percent: 0,
        notes: "",
        trackedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));

    setLibraryTab("progress");
    setOpenMenuId(null);
  }

  function handleProgressChange(song, percent) {
    const songKey = getSongKey(song);

    setProgressBySongId((currentProgress) => {
      const existingEntry = currentProgress[songKey] || {
        percent: 0,
        notes: "",
        trackedAt: new Date().toISOString(),
        updatedAt: "",
      };

      return {
        ...currentProgress,
        [songKey]: {
          ...existingEntry,
          percent,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function handleProgressNotesChange(song, notes) {
    const songKey = getSongKey(song);

    setProgressBySongId((currentProgress) => {
      const existingEntry = currentProgress[songKey] || {
        percent: 0,
        notes: "",
        trackedAt: new Date().toISOString(),
        updatedAt: "",
      };

      return {
        ...currentProgress,
        [songKey]: {
          ...existingEntry,
          notes,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function toggleProgressNotes(song) {
    const songKey = getSongKey(song);

    setExpandedProgressNotes((currentNotes) => ({
      ...currentNotes,
      [songKey]: !currentNotes[songKey],
    }));
  }

  function removeSongProgress(song) {
    const songKey = getSongKey(song);

    const shouldStopTracking = window.confirm(
      `Stop tracking progress for "${song.title}"? Your progress notes for this song will be removed.`
    );

    if (!shouldStopTracking) return;

    setProgressBySongId((currentProgress) => {
      const updatedProgress = { ...currentProgress };
      delete updatedProgress[songKey];
      return updatedProgress;
    });

    setExpandedProgressNotes((currentNotes) => {
      const updatedNotes = { ...currentNotes };
      delete updatedNotes[songKey];
      return updatedNotes;
    });
  }

  async function handleCreateSong(event) {
    event.preventDefault();

    const cleanedTitle = newSongForm.title.trim();
    const cleanedArtist = newSongForm.artist.trim();

    if (!cleanedTitle || !cleanedArtist) {
      alert("Song title and artist are required.");
      return;
    }

    let imageUrl = "";

    try {
      imageUrl = await fetchAlbumArt(cleanedTitle, cleanedArtist);
    } catch (error) {
      console.error("Could not fetch album art:", error);
    }

    const newSong = {
      id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: cleanedTitle,
      artist: cleanedArtist,
      tuning: newSongForm.tuning.trim() || "Standard",
      difficulty: newSongForm.difficulty.trim() || "Beginner",
      capo: newSongForm.capo.trim() || "No capo",
      tab:
        newSongForm.tab.trim() ||
        `[${cleanedTitle}]

  Add your chords or tab here.`,
      imageUrl: imageUrl || "",
      addedAt: new Date().toISOString(),
      playlists: [],
      pinned: false,
      fontSizePx: Number(newSongForm.fontSizePx) || 14,
      source: "manual",
    };

    setSavedSongs((currentSongs) => [...currentSongs, newSong]);
    setSelectedSong(newSong);

    setNewSongForm({
      title: "",
      artist: "",
      tuning: "Standard",
      difficulty: "Beginner",
      capo: "No capo",
      tab: "",
      fontSizePx: 14,
    });

    setIsAddSongOpen(false);

    setTimeout(() => {
      document.querySelector(".song-tab-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function toggleSongMenu(songId) {
    setOpenMenuId((currentId) => (currentId === songId ? null : songId));
  }

  function updateSongById(songId, updates) {
    setSavedSongs((currentSongs) =>
      currentSongs.map((song) =>
        getSongKey(song) === songId ? { ...song, ...updates } : song
      )
    );

    setSelectedSong((currentSong) =>
      currentSong && getSongKey(currentSong) === songId
        ? { ...currentSong, ...updates }
        : currentSong
    );
  }

  function handleOpenSong(song) {
    setSelectedSong(song);
    setOpenMenuId(null);

    setTimeout(() => {
      document.querySelector(".song-tab-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  async function handleAddImage(song) {
    try {
      setOpenMenuId(null);

      const imageUrl = await fetchAlbumArt(song.title, song.artist);

      if (!imageUrl) {
        alert("Could not find album art for this song.");
        return;
      }

      updateSongById(getSongKey(song), {
        imageUrl,
      });

    } catch (error) {
      console.error(error);
      alert("Something went wrong while fetching album art.");
    }
  }

  function handleEditTab(song) {
    setEditingSong(song);

    setEditForm({
      title: song.title || "",
      artist: song.artist || "",
      tuning: song.tuning || "",
      difficulty: song.difficulty || "",
      capo: song.capo || "",
      tab: song.tab || "",
      fontSizePx: song.fontSizePx || 14,
    });

    setOpenMenuId(null);
  }

  function handleSaveEdit(event) {
    event.preventDefault();

    if (!editingSong) return;

    const cleanedTitle = editForm.title.trim();
    const cleanedArtist = editForm.artist.trim();

    if (!cleanedTitle || !cleanedArtist) {
      alert("Song title and artist are required.");
      return;
    }

    // Imported arrangements only show metadata the source or user supplied.
    const keepBlank = editingSong.source === "ultimate-guitar";

    updateSongById(getSongKey(editingSong), {
      title: cleanedTitle,
      artist: cleanedArtist,
      tuning: editForm.tuning.trim() || (keepBlank ? "" : "Standard"),
      difficulty: editForm.difficulty.trim() || (keepBlank ? "" : "Beginner"),
      capo: editForm.capo.trim() || (keepBlank ? "" : "No capo"),
      // Drop blank leading lines only, so a first chord line keeps its indentation.
      tab: editForm.tab.replace(/^(\s*\n)+/, "").trimEnd(),
      fontSizePx: Number(editForm.fontSizePx) || 14,
      updatedAt: new Date().toISOString(),
    });

    setEditingSong(null);
  }

  function handleAddToPlaylist(song) {
    setPlaylistSong(song);
    setPlaylistName("");
    setOpenMenuId(null);
  }

  function handleSaveToPlaylist(event) {
    event.preventDefault();

    if (!playlistSong) return;

    const cleanedPlaylistName = playlistName.trim();

    if (!cleanedPlaylistName) {
      alert("Please enter a playlist name.");
      return;
    }

    setPlaylists((currentPlaylists) => {
      const existingPlaylist = currentPlaylists.find(
        (playlist) =>
          playlist.name.toLowerCase() === cleanedPlaylistName.toLowerCase()
      );

      if (existingPlaylist) {
        return currentPlaylists.map((playlist) => {
          if (playlist.id !== existingPlaylist.id) return playlist;

          if (playlist.songIds.includes(getSongKey(playlistSong))) return playlist;

          return {
            ...playlist,
            songIds: [...playlist.songIds, getSongKey(playlistSong)],
            updatedAt: new Date().toISOString(),
          };
        });
      }

      const newPlaylist = {
        id:
          crypto.randomUUID?.() ||
          `playlist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: cleanedPlaylistName,
        songIds: [getSongKey(playlistSong)],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return [...currentPlaylists, newPlaylist];
    });

    updateSongById(getSongKey(playlistSong), {
      playlists: Array.from(
        new Set([...(playlistSong.playlists || []), cleanedPlaylistName])
      ),
    });

    setPlaylistSong(null);
    setPlaylistName("");
  }

  function handlePinToTop(song) {
    const songKey = getSongKey(song);

    updateSongById(songKey, { pinned: true, pinnedAt: new Date().toISOString() });

    setSavedSongs((currentSongs) => [
      ...currentSongs.filter((savedSong) => getSongKey(savedSong) === songKey),
      ...currentSongs.filter((savedSong) => getSongKey(savedSong) !== songKey),
    ]);

    setOpenMenuId(null);
  }

  async function handleImportArrangement(song) {
    setSavedSongs((currentSongs) => [...currentSongs, song]);

    try {
      const imageUrl = await fetchAlbumArt(song.title, song.artist);
      if (imageUrl) updateSongById(song.id, { imageUrl });
    } catch (error) {
      console.error("Could not fetch album art:", error);
    }
  }

  function handleReplaceArrangement(existingSong, incomingSong) {
    const { tab, tuning, capo, difficulty, key, importedAt } = incomingSong;

    updateSongById(getSongKey(existingSong), {
      tab,
      importedAt,
      updatedAt: importedAt,
      ...(tuning && { tuning }),
      ...(capo && { capo }),
      ...(key && { key }),
      ...(difficulty && { difficulty }),
    });
  }

  function getSongImageUrl(song) {
    return song.imageUrl || albumArtBySongId[song.id] || "";
  }


  function addSong(song) {
    const alreadySaved = savedSongs.some(
      (savedSong) => getSongKey(savedSong) === getSongKey(song)
    );

    if (alreadySaved) return;

    const songToSave = {
      ...song,
      id: song.id || createSongId(song, song.source || "song"),
      imageUrl: getSongImageUrl(song),
      tab:
        song.tab ||
        `[${song.title}]

  Add your chords or tab here.`,
      addedAt: new Date().toISOString(),
      playlists: song.playlists || [],
      pinned: false,
      fontSizePx: song.fontSizePx || 14,
    };

    setSavedSongs((currentSongs) => [...currentSongs, songToSave]);
  }

  function removeSong(songId) {
    const shouldRemove = window.confirm("Remove this song from your saved tabs?");

    if (!shouldRemove) return;

    setSavedSongs((currentSongs) =>
      currentSongs.filter((song) => getSongKey(song) !== songId)
    );

    setPlaylists((currentPlaylists) =>
      currentPlaylists.map((playlist) => ({
        ...playlist,
        songIds: playlist.songIds.filter((id) => id !== songId),
      }))
    );

    saveTranspose(songId, { semitones: 0, flats: null });

    if (selectedSong && getSongKey(selectedSong) === songId) {
      setSelectedSong(null);
    }

    setProgressBySongId((currentProgress) => {
      const updatedProgress = { ...currentProgress };
      delete updatedProgress[songId];
      return updatedProgress;
    });

    setExpandedProgressNotes((currentNotes) => {
      const updatedNotes = { ...currentNotes };
      delete updatedNotes[songId];
      return updatedNotes;
    });

    setOpenMenuId(null);
  }

  function isSongSaved(songId) {
    return savedSongs.some((song) => getSongKey(song) === songId);
  }

  const fretzPickPlaylist = {
    id: "fretz-picks",
    name: "♛ Fretz Picks",
    songs: savedSongs.filter(isFretzPick),
    isSystemPlaylist: true,
  };

  const songsByKey = new Map(savedSongs.map((song) => [getSongKey(song), song]));

  const visiblePlaylists = [
    fretzPickPlaylist,
    ...playlists.map((playlist) => ({
      ...playlist,
      songs: playlist.songIds.map((id) => songsByKey.get(id)).filter(Boolean),
    })),
  ];

  const selectedPlaylist =
    visiblePlaylists.find((playlist) => playlist.id === selectedPlaylistId) ||
    visiblePlaylists[0] ||
    null;

  const progressSongs = useMemo(() => {
    return savedSongs.filter((song) => progressBySongId[getSongKey(song)]);
  }, [savedSongs, progressBySongId]);

  const averageProgress =
    progressSongs.length > 0
      ? Math.round(
          progressSongs.reduce((total, song) => {
            return total + Number(getProgressEntry(song).percent || 0);
          }, 0) / progressSongs.length
        )
      : 0;

  const visibleSongs =
    libraryTab === "progress"
      ? progressSongs
      : libraryTab === "playlists" && selectedPlaylist
        ? selectedPlaylist.songs || []
        : savedSongs;

  function isFretzPick(song) {
    return song.source === "hardcoded";
  }

  return (
    <main className="home-page">
      <section className="home-header">
        {/* <p className="eyebrow">My Tabs</p> */}

        <img
          className="fretz-logo"
          src="/FretzLogo-3.png"
          alt="Fretz"
        />
      </section>

      <section className="search-panel">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="What do you want to play?"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
          />

          {query && (
            <button className="clear-search-button" onClick={() => updateQuery("")}>
              <FiX />
            </button>
          )}
        </div>

        {query && (
          <div className="search-results">
            {isSearchingSongs ? (
              <p className="empty-message">Searching...</p>
            ) : searchError ? (
              <p className="empty-message">{searchError}</p>
            ) : searchResults.length > 0 ? (
              searchResults.map((song) => (
                <article className="search-result-card" key={getSongKey(song)}>
                  <div className="song-icon">
                    {getSongImageUrl(song) ? (
                      <img
                        className="song-cover-image"
                        src={getSongImageUrl(song)}
                        alt={`${song.title} cover`}
                      />
                    ) : (
                      <FiMusic />
                    )}
                  </div>

                  <div className="song-text">
                    <div className="song-title-row">
                      <h3>{song.title}</h3>

                      {song.source === "hardcoded" && (
                        <span className="hardcoded-tag">♛ Fretz Pick</span>
                      )}
                    </div>

                    <p>{song.artist}</p>
                  </div>

                  <button
                    className="add-song-button"
                    onClick={() => addSong(song)}
                    disabled={isSongSaved(getSongKey(song))}
                  >
                    {isSongSaved(getSongKey(song)) ? "Added" : <FiPlus />}
                  </button>
                </article>
              ))
            ) : (
              <p className="empty-message">No songs found.</p>
            )}
          </div>
        )}
      </section>

      <UltimateGuitarImport
        savedSongs={savedSongs}
        onImport={handleImportArrangement}
        onReplace={handleReplaceArrangement}
        onOpenSong={(song) =>
          handleOpenSong(
            savedSongs.find((savedSong) => getSongKey(savedSong) === getSongKey(song)) || song
          )
        }
      />

      <section className="library-section">
        <div className="library-tabs">
          <button
            className={libraryTab === "songs" ? "library-tab active" : "library-tab"}
            onClick={() => setLibraryTab("songs")}
          >
            My Songs
          </button>

          <button
            className={
              libraryTab === "playlists" ? "library-tab active" : "library-tab"
            }
            onClick={() => setLibraryTab("playlists")}
          >
            Playlists
          </button>

          <button
            className={
              libraryTab === "progress" ? "library-tab active" : "library-tab"
            }
            onClick={() => setLibraryTab("progress")}
          >
            Progress
          </button>
        </div>

        <div className="section-title-row">
          <div>
            <button
              className="saved-songs-toggle"
              onClick={() => setShowSavedCount((currentValue) => !currentValue)}
            >
              {libraryTab === "playlists"
                ? "Playlists"
                : libraryTab === "progress"
                  ? "Progress"
                  : "My Songs"}
            </button>

            {showSavedCount && (
              <p>
                {libraryTab === "playlists"
                  ? `${visiblePlaylists.length} playlist${visiblePlaylists.length === 1 ? "" : "s"}`
                  : libraryTab === "progress"
                    ? `${progressSongs.length} tracked song${progressSongs.length === 1 ? "" : "s"}${
                        progressSongs.length > 0 ? ` • ${averageProgress}% average` : ""
                      }`
                    : `${savedSongs.length} saved tab${savedSongs.length === 1 ? "" : "s"}`}
              </p>
            )}
          </div>

          <div className="library-actions">
            <button
              className="library-action-button"
              onClick={handleImportButtonClick}
            >
              Import
            </button>

            <button
              className="library-action-button"
              onClick={handleExportSongs}
              disabled={savedSongs.length === 0}
            >
              Export
            </button>

            <button
              className="library-action-button danger"
              onClick={handleDeleteAllSongs}
              disabled={savedSongs.length === 0 && playlists.length === 0}
            >
              Delete all
            </button>

            <button
              className="add-custom-song-button"
              onClick={() => setIsAddSongOpen(true)}
            >
              <FiPlus />
              <span>Add song</span>
            </button>
          </div>

          <input
            ref={importFileInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={handleImportSongs}
          />
        </div>

        {libraryTab === "playlists" && (
          <div className="playlist-filter-row">
            {visiblePlaylists.length > 0 ? (
              visiblePlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  className={[
                    "playlist-filter-chip",
                    selectedPlaylist?.id === playlist.id ? "active" : "",
                    playlist.isSystemPlaylist ? "system" : "",
                  ].join(" ")}
                  onClick={() => setSelectedPlaylistId(playlist.id)}
                >
                  {playlist.name}
                  <span>{playlist.songs?.length || 0}</span>
                </button>
              ))
            ) : (
              <p className="empty-message">
                No playlists yet. Use a song&apos;s three-dot menu to add one.
              </p>
            )}
          </div>
        )}

        {visibleSongs.length > 0 ? (
          libraryTab === "progress" ? (
            <div className="progress-song-list">
              {progressSongs.map((song) => {
                const songKey = getSongKey(song);
                const progressEntry = getProgressEntry(song);
                const isNotesOpen = expandedProgressNotes[songKey];

                return (
                  <article className="progress-song-card" key={songKey}>
                    <div className="progress-song-header">
                      <div className="song-icon">
                        {song.imageUrl ? (
                          <img
                            className="song-cover-image"
                            src={song.imageUrl}
                            alt={`${song.title} cover`}
                          />
                        ) : (
                          <FiMusic />
                        )}
                      </div>

                      <div className="song-text">
                        <div className="song-title-row">
                          <h3>{song.title}</h3>

                          {song.source === "hardcoded" && (
                            <span className="hardcoded-tag">♛ Fretz Pick</span>
                          )}

                          {song.source === "ultimate-guitar" && (
                            <span className="source-tag" title="Imported from Ultimate Guitar">
                            UG{song.sourceArrangementType && ` · ${song.sourceArrangementType}`}
                          </span>
                          )}
                        </div>

                        <p>{song.artist}</p>
                      </div>

                      {/* <strong className="progress-percent">
                        {progressEntry.percent || 0}%
                      </strong> */}
                    </div>

                    <div className="progress-slider-block">
                      <div className="progress-slider-label-row">
                        <span> </span>
                        <span>{progressEntry.percent || 0}% learned</span>
                      </div>

                      <input
                        className="progress-slider"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={progressEntry.percent || 0}
                        onChange={(event) =>
                          handleProgressChange(song, Number(event.target.value))
                        }
                      />

                      <div className="progress-slider-markers">
                        {/* <span>Learning</span>
                        <span>Getting it</span>
                        <span>Performance ready</span> */}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="progress-notes-toggle"
                      onClick={() => toggleProgressNotes(song)}
                    >
                      {isNotesOpen ? <FiChevronUp /> : <FiChevronDown />}
                      <span>
                        {isNotesOpen
                          ? "Hide notes"
                          : progressEntry.notes?.trim()
                            ? "View notes"
                            : "Add notes"}
                      </span>
                    </button>

                    {isNotesOpen && (
                      <label className="progress-notes-area">
                        Practice notes
                        <textarea
                          placeholder="Example: Work on the chorus changes, clean up the bridge, practice slowly at 70 BPM..."
                          value={progressEntry.notes || ""}
                          onChange={(event) =>
                            handleProgressNotesChange(song, event.target.value)
                          }
                        />
                      </label>
                    )}

                    <div className="progress-card-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleOpenSong(song)}
                      >
                        Open tab
                      </button>

                      <button
                        type="button"
                        className="progress-remove-button"
                        onClick={() => removeSongProgress(song)}
                      >
                        Stop tracking
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="saved-song-list">
              {visibleSongs.map((song) => (
                <article
                  className={`saved-song-card ${
                    selectedSong && getSongKey(selectedSong) === getSongKey(song) ? "selected" : ""
                  }`}
                  key={getSongKey(song)}
                >
                  <button
                    className="saved-song-main"
                    onClick={() => handleOpenSong(song)}
                  >
                    <div className="song-icon">
                      {song.imageUrl ? (
                        <img
                          className="song-cover-image"
                          src={song.imageUrl}
                          alt={`${song.title} cover`}
                        />
                      ) : (
                        <FiMusic />
                      )}
                    </div>

                    <div className="song-text">
                      <div className="song-title-row">
                        <h3>
                          {song.pinned && <span className="pin-indicator">★ </span>}
                          {song.title}
                        </h3>

                        {song.source === "hardcoded" && (
                          <span className="hardcoded-tag">♛ Fretz Pick</span>
                        )}

                        {song.source === "ultimate-guitar" && (
                          <span className="source-tag" title="Imported from Ultimate Guitar">
                            UG{song.sourceArrangementType && ` · ${song.sourceArrangementType}`}
                          </span>
                        )}
                      </div>

                      <p>{song.artist}</p>
                    </div>
                  </button>

                  <div className="song-actions">
                    <button
                      className="song-menu-button"
                      onClick={() => toggleSongMenu(getSongKey(song))}
                      aria-label={`Open menu for ${song.title}`}
                    >
                      <FiMoreVertical />
                    </button>

                    {openMenuId === getSongKey(song) && (
                      <div className="song-menu">
                        <button onClick={() => handleOpenSong(song)}>
                          <FiEye />
                          <span>Open tab</span>
                        </button>

                        <button onClick={() => handleEditTab(song)}>
                          <FiEdit3 />
                          <span>Edit tab</span>
                        </button>

                        <button onClick={() => handleAddToPlaylist(song)}>
                          <FiList />
                          <span>Add to playlist</span>
                        </button>

                        <button onClick={() => handleTrackProgress(song)}>
                          <FiTrendingUp />
                          <span>
                            {progressBySongId[getSongKey(song)]
                              ? "View progress"
                              : "Track progress"}
                          </span>
                        </button>

                        <button onClick={() => handlePinToTop(song)}>
                          <FiStar />
                          <span>Pin to top</span>
                        </button>

                        <button onClick={() => handleAddImage(song)}>
                          <FiImage />
                          <span>Find album art</span>
                        </button>

                        <button
                          className="danger"
                          onClick={() => removeSong(getSongKey(song))}
                        >
                          <FiTrash2 />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )
        ) : (
          <div className="empty-library">
            <FiMusic />
            <h3>
              {libraryTab === "progress"
                ? "No songs tracked yet"
                : libraryTab === "playlists"
                  ? "No songs in this playlist"
                  : "No tabs saved yet"}
            </h3>
            <p>
              {libraryTab === "progress"
                ? "Use a song's three-dot menu and choose Track progress."
                : libraryTab === "playlists"
                  ? "Add songs to a playlist from the three-dot menu."
                  : "Search for a song above and add it to your list."}
            </p>
          </div>
        )}
      </section>

      {selectedSong && (
        <SongTab key={selectedSong.id} song={selectedSong} onClose={() => setSelectedSong(null)} />
      )}

      {editingSong && (
        <div className="modal-backdrop">
          <form className="edit-tab-modal" onSubmit={handleSaveEdit}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Edit Tab</p>
                <h2>{editingSong.title}</h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => setEditingSong(null)}
              >
                <FiX />
              </button>
            </div>

            <label>
              Song title
              <input
                value={editForm.title}
                onChange={(event) =>
                  setEditForm((currentForm) => ({
                    ...currentForm,
                    title: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Artist
              <input
                value={editForm.artist}
                onChange={(event) =>
                  setEditForm((currentForm) => ({
                    ...currentForm,
                    artist: event.target.value,
                  }))
                }
              />
            </label>

            <div className="form-grid">
              <label>
                Tuning
                <input
                  value={editForm.tuning}
                  onChange={(event) =>
                    setEditForm((currentForm) => ({
                      ...currentForm,
                      tuning: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Capo
                <input
                  value={editForm.capo}
                  onChange={(event) =>
                    setEditForm((currentForm) => ({
                      ...currentForm,
                      capo: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Difficulty
                <input
                  value={editForm.difficulty}
                  onChange={(event) =>
                    setEditForm((currentForm) => ({
                      ...currentForm,
                      difficulty: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label>
              Tab font size px
              <input
                type="number"
                min="8"
                max="40"
                value={editForm.fontSizePx}
                onChange={(event) =>
                  setEditForm((currentForm) => ({
                    ...currentForm,
                    fontSizePx: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Tab
              <textarea
                value={editForm.tab}
                onChange={(event) =>
                  setEditForm((currentForm) => ({
                    ...currentForm,
                    tab: event.target.value,
                  }))
                }
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditingSong(null)}
              >
                Cancel
              </button>

              <button type="submit" className="primary-button">
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

      {playlistSong && (
        <div className="modal-backdrop">
          <form className="playlist-modal" onSubmit={handleSaveToPlaylist}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Add to Playlist</p>
                <h2>{playlistSong.title}</h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => setPlaylistSong(null)}
              >
                <FiX />
              </button>
            </div>

            <label>
              Playlist name
              <input
                placeholder="Favorites, Practice, Acoustic..."
                value={playlistName}
                onChange={(event) => setPlaylistName(event.target.value)}
              />
            </label>

            {playlists.length > 0 && (
              <div className="existing-playlists">
                <p>Existing playlists</p>

                <div className="playlist-chip-row">
                  {playlists.map((playlist) => (
                    <button
                      type="button"
                      className="playlist-chip"
                      key={playlist.id}
                      onClick={() => setPlaylistName(playlist.name)}
                    >
                      {playlist.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPlaylistSong(null)}
              >
                Cancel
              </button>

              <button type="submit" className="primary-button">
                Add song
              </button>
            </div>
          </form>
        </div>
      )}


      {isAddSongOpen && (
        <div className="modal-backdrop">
          <form className="edit-tab-modal" onSubmit={handleCreateSong}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">New Song</p>
                <h2>Add a custom tab</h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => setIsAddSongOpen(false)}
              >
                <FiX />
              </button>
            </div>

            <label>
              Song title
              <input
                value={newSongForm.title}
                onChange={(event) =>
                  setNewSongForm((currentForm) => ({
                    ...currentForm,
                    title: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Artist
              <input
                value={newSongForm.artist}
                onChange={(event) =>
                  setNewSongForm((currentForm) => ({
                    ...currentForm,
                    artist: event.target.value,
                  }))
                }
              />
            </label>

            <div className="form-grid">
              <label>
                Tuning
                <input
                  value={newSongForm.tuning}
                  onChange={(event) =>
                    setNewSongForm((currentForm) => ({
                      ...currentForm,
                      tuning: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Capo
                <input
                  value={newSongForm.capo}
                  onChange={(event) =>
                    setNewSongForm((currentForm) => ({
                      ...currentForm,
                      capo: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Difficulty
                <input
                  value={newSongForm.difficulty}
                  onChange={(event) =>
                    setNewSongForm((currentForm) => ({
                      ...currentForm,
                      difficulty: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label>
              Tab font size px
              <input
                type="number"
                min="8"
                max="40"
                value={newSongForm.fontSizePx}
                onChange={(event) =>
                  setNewSongForm((currentForm) => ({
                    ...currentForm,
                    fontSizePx: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Tab
              <textarea
                placeholder={`[Intro]\nG  D  Em  C\n\n[Verse]\nG\nYour chords/tab here...`}
                value={newSongForm.tab}
                onChange={(event) =>
                  setNewSongForm((currentForm) => ({
                    ...currentForm,
                    tab: event.target.value,
                  }))
                }
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsAddSongOpen(false)}
              >
                Cancel
              </button>

              <button type="submit" className="primary-button">
                Add song
              </button>
            </div>
          </form>
        </div>
      )}


    </main>
  );
}