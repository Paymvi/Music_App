import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiPlus, FiMusic, FiChevronRight, FiX } from "react-icons/fi";
import SongTab from "../components/SongTab";
import { MOCK_SONGS } from "../data/mockSongs";


export default function Home() {
  const [query, setQuery] = useState("");
  const [savedSongs, setSavedSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("savedSongs")) || [];
    setSavedSongs(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("savedSongs", JSON.stringify(savedSongs));
  }, [savedSongs]);

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

  function addSong(song) {
    const alreadySaved = savedSongs.some((savedSong) => savedSong.id === song.id);

    if (alreadySaved) return;

    setSavedSongs((currentSongs) => [...currentSongs, song]);
  }

  function removeSong(songId) {
    setSavedSongs((currentSongs) =>
      currentSongs.filter((song) => song.id !== songId)
    );

    if (selectedSong?.id === songId) {
      setSelectedSong(null);
    }
  }

  function isSongSaved(songId) {
    return savedSongs.some((song) => song.id === songId);
  }

  return (
    <main className="home-page">
      <section className="home-header">
        <p className="eyebrow">My Tabs</p>
        <h1>Fretz</h1>
        <p className="home-subtitle">
          Search songs, save them to your list, and open tabs without the clutter.
        </p>
      </section>

      <section className="search-panel">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search songs or artists..."
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
                    <FiMusic />
                  </div>

                  <div className="song-text">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>

                  <button
                    className="add-song-button"
                    onClick={() => addSong(song)}
                    disabled={isSongSaved(song.id)}
                  >
                    {isSongSaved(song.id) ? "Added" : <FiPlus />}
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
            <p>{savedSongs.length} saved tab{savedSongs.length === 1 ? "" : "s"}</p>
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
                  onClick={() => setSelectedSong(song)}
                >
                  <div className="song-icon">
                    <FiMusic />
                  </div>

                  <div className="song-text">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>

                  <FiChevronRight className="song-arrow" />
                </button>

                <button
                  className="remove-song-button"
                  onClick={() => removeSong(song.id)}
                  aria-label={`Remove ${song.title}`}
                >
                  <FiX />
                </button>
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
    </main>
  );
}