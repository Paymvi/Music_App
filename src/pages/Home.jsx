import { useEffect, useMemo, useState } from "react";
import { fetchAlbumArt } from "../api/albumArt";

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
} from "react-icons/fi";

import SongTab from "../components/SongTab";
import { MOCK_SONGS } from "../data/mockSongs";

export default function Home() {
  const [query, setQuery] = useState("");

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
    fontSize: 14,
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

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("savedSongs")) || [];
    const savedPlaylists = JSON.parse(localStorage.getItem("playlists")) || [];

    setSavedSongs(saved);
    setPlaylists(savedPlaylists);
  }, []);

  useEffect(() => {
    localStorage.setItem("savedSongs", JSON.stringify(savedSongs));
  }, [savedSongs]);

  useEffect(() => {
    localStorage.setItem("playlists", JSON.stringify(playlists));
  }, [playlists]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const normalizedQuery = query.toLowerCase();

    return MOCK_SONGS.filter((song) => {
      return (
        song.title.toLowerCase().includes(normalizedQuery) ||
        song.artist.toLowerCase().includes(normalizedQuery)
      );
    });
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

  function toggleSongMenu(songId) {
    setOpenMenuId((currentId) => (currentId === songId ? null : songId));
  }

  function updateSongById(songId, updates) {
    setSavedSongs((currentSongs) =>
      currentSongs.map((song) =>
        song.id === songId ? { ...song, ...updates } : song
      )
    );

    setSelectedSong((currentSong) =>
      currentSong?.id === songId ? { ...currentSong, ...updates } : currentSong
    );
  }

  async function handleAddImage(song) {
    try {
      setOpenMenuId(null);

      const imageUrl = await fetchAlbumArt(song.title, song.artist);

      if (!imageUrl) {
        alert("Could not find album art for this song.");
        return;
      }

      updateSongById(song.id, {
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

    updateSongById(editingSong.id, {
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
            (song) => song.id === playlistSong.id
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

    updateSongById(playlistSong.id, {
      playlists: Array.from(
        new Set([...(playlistSong.playlists || []), cleanedPlaylistName])
      ),
    });

    setPlaylistSong(null);
    setPlaylistName("");
  }

  function handlePinToTop(song) {
    setSavedSongs((currentSongs) => {
      const updatedSong = {
        ...song,
        pinned: true,
        pinnedAt: new Date().toISOString(),
      };

      const songsWithoutPinned = currentSongs.filter(
        (savedSong) => savedSong.id !== song.id
      );

      return [updatedSong, ...songsWithoutPinned];
    });

    setSelectedSong((currentSong) =>
      currentSong?.id === song.id
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

  async function addSong(song) {
    const alreadySaved = savedSongs.some((savedSong) => savedSong.id === song.id);

    if (alreadySaved) return;

    let imageUrl = getSongImageUrl(song);

    if (!imageUrl) {
      try {
        setLoadingArtIds((currentIds) => [...new Set([...currentIds, song.id])]);

        imageUrl = await fetchAlbumArt(song.title, song.artist);

        if (imageUrl) {
          setAlbumArtBySongId((currentArt) => ({
            ...currentArt,
            [song.id]: imageUrl,
          }));
        }
      } catch (error) {
        console.error("Could not fetch album art:", error);
      } finally {
        setLoadingArtIds((currentIds) =>
          currentIds.filter((id) => id !== song.id)
        );
      }
    }

    const songToSave = {
      ...song,
      imageUrl,
      addedAt: new Date().toISOString(),
      playlists: [],
      pinned: false,
    };

    setSavedSongs((currentSongs) => [...currentSongs, songToSave]);
  }

  function removeSong(songId) {
    const shouldRemove = window.confirm("Remove this song from your saved tabs?");

    if (!shouldRemove) return;

    setSavedSongs((currentSongs) =>
      currentSongs.filter((song) => song.id !== songId)
    );

    setPlaylists((currentPlaylists) =>
      currentPlaylists.map((playlist) => ({
        ...playlist,
        songs: playlist.songs.filter((song) => song.id !== songId),
      }))
    );

    if (selectedSong?.id === songId) {
      setSelectedSong(null);
    }

    setOpenMenuId(null);
  }

  function isSongSaved(songId) {
    return savedSongs.some((song) => song.id === songId);
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
            {searchResults.length > 0 ? (
              searchResults.map((song) => (
                <article className="search-result-card" key={song.id}>
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
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>

                  <button
                    className="add-song-button"
                    onClick={() => addSong(song)}
                    disabled={isSongSaved(song.id) || loadingArtIds.includes(song.id)}
                  >
                    {isSongSaved(song.id)
                      ? "Added"
                      : loadingArtIds.includes(song.id)
                        ? "..."
                        : <FiPlus />}
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
        <div className="section-title-row">
          <div>
            <h2>Saved Songs</h2>
            <p>
              {savedSongs.length} saved tab
              {savedSongs.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {savedSongs.length > 0 ? (
          <div className="saved-song-list">
            {savedSongs.map((song) => (
              <article
                className={`saved-song-card ${
                  selectedSong?.id === song.id ? "selected" : ""
                }`}
                key={song.id}
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
                    <h3>
                      {song.pinned && <span className="pin-indicator">★ </span>}
                      {song.title}
                    </h3>
                    <p>{song.artist}</p>
                  </div>
                </button>

                <div className="song-actions">
                  <button
                    className="song-menu-button"
                    onClick={() => toggleSongMenu(song.id)}
                    aria-label={`Open menu for ${song.title}`}
                  >
                    <FiMoreVertical />
                  </button>

                  {openMenuId === song.id && (
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
                        onClick={() => removeSong(song.id)}
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
        ) : (
          <div className="empty-library">
            <FiMusic />
            <h3>No tabs saved yet</h3>
            <p>Search for a song above and add it to your list.</p>
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
    </main>
  );
}