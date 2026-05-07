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
import { MOCK_SONGS } from "../data/mockSongs";

console.log("MOCK_SONGS loaded:", MOCK_SONGS.map((song) => song.title));

export default function Home() {
  const [query, setQuery] = useState("");
  const [showSavedCount, setShowSavedCount] = useState(true);
  const [editingSongKey, setEditingSongKey] = useState(null);

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
  const [loadingArtIds, setLoadingArtIds] = useState([]);
  
  const [savedSongs, setSavedSongs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("savedSongs")) || [];
    } catch {
      return [];
    }
  });

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

  const [playlists, setPlaylists] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("playlists")) || [];
    } catch {
      return [];
    }
  });

  const [progressBySongId, setProgressBySongId] = useState(() => {
    try {
      const storedProgress = JSON.parse(localStorage.getItem("songProgress")) || {};

      return storedProgress && typeof storedProgress === "object" && !Array.isArray(storedProgress)
        ? storedProgress
        : {};
    } catch {
      return {};
    }
  });

  const [expandedProgressNotes, setExpandedProgressNotes] = useState({});


  useEffect(() => {
    localStorage.setItem("savedSongs", JSON.stringify(savedSongs));
  }, [savedSongs]);

  useEffect(() => {
    localStorage.setItem("playlists", JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    const controller = new AbortController();

    async function runSongSearch() {
      try {
        setIsSearchingSongs(true);
        setSearchError("");

        const normalizedQuery = query.toLowerCase();

        const hardcodedResults = MOCK_SONGS.filter((song) => {
          return (
            song.title.toLowerCase().includes(normalizedQuery) ||
            song.artist.toLowerCase().includes(normalizedQuery)
          );
        }).map((song) => ({
          ...song,
          source: "hardcoded",
          imageUrl: getSongImageUrl(song),
          fontSizePx: song.fontSizePx || 14,
        }));

        const apiResults = await searchSongs(query, {
          signal: controller.signal,
        });

        const hardcodedIds = new Set(hardcodedResults.map((song) => song.id));

        const uniqueApiResults = apiResults.filter(
          (song) => !hardcodedIds.has(song.id)
        );

        setSearchResults([...hardcodedResults, ...uniqueApiResults]);
      } catch (error) {
        if (error.name === "AbortError") return;

        console.error(error);

        const normalizedQuery = query.toLowerCase();

        const fallbackHardcodedResults = MOCK_SONGS.filter((song) => {
          return (
            song.title.toLowerCase().includes(normalizedQuery) ||
            song.artist.toLowerCase().includes(normalizedQuery)
          );
        }).map((song) => ({
          ...song,
          source: "hardcoded",
          imageUrl: getSongImageUrl(song),
          fontSizePx: song.fontSizePx || 14,
        }));

        setSearchResults(fallbackHardcodedResults);

        if (fallbackHardcodedResults.length === 0) {
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
      const songsMissingArt = searchResults.filter(
        (song) => !albumArtBySongId[song.id]
      );

      if (songsMissingArt.length === 0) return;

      setLoadingArtIds((currentIds) => [
        ...new Set([...currentIds, ...songsMissingArt.map((song) => song.id)]),
      ]);

      const results = await Promise.allSettled(
        songsMissingArt.map(async (song) => {
          const imageUrl = await fetchAlbumArt(song.title, song.artist);

          return {
            songId: song.id,
            imageUrl,
          };
        })
      );

      if (isCancelled) return;

      setAlbumArtBySongId((currentArt) => {
        const updatedArt = { ...currentArt };

        results.forEach((result) => {
          if (result.status !== "fulfilled") return;

          const { songId, imageUrl } = result.value;

          if (imageUrl) {
            updatedArt[songId] = imageUrl;
          }
        });

        return updatedArt;
      });

      setLoadingArtIds((currentIds) =>
        currentIds.filter(
          (id) => !songsMissingArt.some((song) => song.id === id)
        )
      );
    }

    loadAlbumArtForSearchResults();

    return () => {
      isCancelled = true;
    };
  }, [searchResults, albumArtBySongId]);

  useEffect(() => {
    localStorage.setItem("songProgress", JSON.stringify(progressBySongId));
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
      version: 1,
      exportedAt: new Date().toISOString(),
      savedSongs,
      playlists,
      progressBySongId,
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

  function normalizeImportedSong(song) {
    return {
      id: song.id || createSongId(song, "imported"),
      title: song.title || "Untitled Song",
      artist: song.artist || "Unknown Artist",
      tuning: song.tuning || "Standard",
      difficulty: song.difficulty || "Beginner",
      capo: song.capo || "No capo",
      tab: song.tab || `[${song.title || "Untitled Song"}]\n\nAdd your chords or tab here.`,
      imageUrl: getSongImageUrl(song),
      addedAt: song.addedAt || new Date().toISOString(),
      playlists: Array.isArray(song.playlists) ? song.playlists : [],
      pinned: Boolean(song.pinned),
      pinnedAt: song.pinnedAt || "",
      fontSizePx: Number(song.fontSizePx) || 14,
      source: song.source || "imported",
    };
  }

  function mergeSongs(existingSongs, importedSongs) {
    const songMap = new Map();

    existingSongs.forEach((song) => {
      songMap.set(getSongKey(song), song);
    });

    importedSongs.forEach((song) => {
      songMap.set(getSongKey(song), song);
    });

    return Array.from(songMap.values());
  }

  async function handleImportSongs(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const importedSongs = Array.isArray(data.savedSongs)
        ? data.savedSongs.map(normalizeImportedSong)
        : Array.isArray(data)
          ? data.map(normalizeImportedSong)
          : [];

      const importedPlaylists = Array.isArray(data.playlists)
        ? data.playlists
        : [];

      if (importedSongs.length === 0 && importedPlaylists.length === 0) {
        alert("This file does not contain any Fretz songs or playlists.");
        return;
      }

      const shouldImport = window.confirm(
        `Import ${importedSongs.length} song${importedSongs.length === 1 ? "" : "s"} and ${importedPlaylists.length} playlist${importedPlaylists.length === 1 ? "" : "s"}?\n\nSongs with the same ID will be updated.`
      );

      if (!shouldImport) return;

      setSavedSongs((currentSongs) =>
        mergeSongs(currentSongs, importedSongs)
      );

      setPlaylists((currentPlaylists) => {
        const playlistMap = new Map();

        currentPlaylists.forEach((playlist) => {
          playlistMap.set(playlist.id || playlist.name, playlist);
        });

        importedPlaylists.forEach((playlist) => {
          const playlistId =
            playlist.id ||
            `playlist-${Date.now()}-${Math.random().toString(16).slice(2)}`;

          playlistMap.set(playlistId, {
            id: playlistId,
            name: playlist.name || "Imported Playlist",
            songs: Array.isArray(playlist.songs)
              ? playlist.songs.map(normalizeImportedSong)
              : [],
            createdAt: playlist.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });

        return Array.from(playlistMap.values());
      });

      if (
        data.progressBySongId &&
        typeof data.progressBySongId === "object" &&
        !Array.isArray(data.progressBySongId)
      ) {
        setProgressBySongId((currentProgress) => ({
          ...currentProgress,
          ...data.progressBySongId,
        }));
      }

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

  function getSongKey(song) {
    return (
      song?.id ||
      `${song?.title || "untitled"}-${song?.artist || "unknown"}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
  }
  function createSongId(song, prefix = "song") {
    const title = song?.title || "untitled";
    const artist = song?.artist || "unknown";

    const slug = `${title}-${artist}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    return `${prefix}-${slug || Date.now()}`;
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

    setPlaylists((currentPlaylists) =>
      currentPlaylists.map((playlist) => ({
        ...playlist,
        songs: playlist.songs.map((song) =>
          getSongKey(song) === songId ? { ...song, ...updates } : song
        ),
        updatedAt: new Date().toISOString(),
      }))
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
    setEditingSongKey(getSongKey(song));

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

    updateSongById(getSongKey(editingSong), {
      title: cleanedTitle,
      artist: cleanedArtist,
      tuning: editForm.tuning.trim() || "Standard",
      difficulty: editForm.difficulty.trim() || "Beginner",
      capo: editForm.capo.trim() || "No capo",
      tab: editForm.tab.trim(),
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

          const alreadyInPlaylist = playlist.songs.some(
            (song) => getSongKey(song) === getSongKey(playlistSong)
          );

          if (alreadyInPlaylist) return playlist;

          return {
            ...playlist,
            songs: [...playlist.songs, playlistSong],
            updatedAt: new Date().toISOString(),
          };
        });
      }

      const newPlaylist = {
        id:
          crypto.randomUUID?.() ||
          `playlist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: cleanedPlaylistName,
        songs: [playlistSong],
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

    setSavedSongs((currentSongs) => {
      const updatedSong = {
        ...song,
        pinned: true,
        pinnedAt: new Date().toISOString(),
      };

      const songsWithoutPinned = currentSongs.filter(
        (savedSong) => getSongKey(savedSong) !== songKey
      );

      return [updatedSong, ...songsWithoutPinned];
    });

    setSelectedSong((currentSong) =>
      currentSong && getSongKey(currentSong) === songKey
        ? {
            ...currentSong,
            pinned: true,
            pinnedAt: new Date().toISOString(),
          }
        : currentSong
    );

    setOpenMenuId(null);
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
        songs: playlist.songs.filter((song) => getSongKey(song) !== songId),
      }))
    );

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

  const visiblePlaylists = [fretzPickPlaylist, ...playlists];

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
            onChange={(event) => setQuery(event.target.value)}
          />

          {query && (
            <button className="clear-search-button" onClick={() => setQuery("")}>
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
        <SongTab song={selectedSong} onClose={() => setSelectedSong(null)} />
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
                onClick={() => {
                  setEditingSong(null);
                  setEditingSongKey(null);
                }}
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
                onClick={() => {
                  setEditingSong(null);
                  setEditingSongKey(null);
                }}
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