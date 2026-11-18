// Library data rules shared by Home and its tests: song keys, playlist storage and backup import.

export function getSongKey(song) {
  return (
    song?.id ||
    `${song?.title || "untitled"}-${song?.artist || "unknown"}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}

export function createSongId(song, prefix = "song") {
  return `${prefix}-${getSongKey({ title: song?.title, artist: song?.artist }) || Date.now()}`;
}

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const newPlaylistId = () =>
  globalThis.crypto?.randomUUID?.() || `playlist-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function normalizeImportedSong(song) {
  if (!isPlainObject(song)) return null;

  return {
    ...song,
    id: song.id || createSongId(song, "imported"),
    title: song.title || "Untitled Song",
    artist: song.artist || "Unknown Artist",
    tuning: song.tuning ?? "Standard",
    difficulty: song.difficulty ?? "Beginner",
    capo: song.capo ?? "No capo",
    tab: song.tab || `[${song.title || "Untitled Song"}]\n\nAdd your chords or tab here.`,
    imageUrl: song.imageUrl || "",
    addedAt: song.addedAt || new Date().toISOString(),
    playlists: Array.isArray(song.playlists) ? song.playlists : [],
    pinned: Boolean(song.pinned),
    pinnedAt: song.pinnedAt || "",
    fontSizePx: Number(song.fontSizePx) || 14,
    source: song.source || "imported",
  };
}

// Playlists store song keys. Older data stored full song copies in `songs`: those become keys,
// and a copied song missing from the library is added to it so nothing is lost.
export function migrateLibrary(songs, playlists) {
  const library = new Map(songs.map((song) => [getSongKey(song), song]));
  const now = new Date().toISOString();

  const migrated = playlists.filter(isPlainObject).map((playlist) => {
    const songIds = Array.isArray(playlist.songIds)
      ? playlist.songIds
      : (Array.isArray(playlist.songs) ? playlist.songs : [])
          .map((rawSong) => {
            const song = normalizeImportedSong(rawSong);
            if (!song) return null;
            const key = getSongKey(song);
            if (!library.has(key)) library.set(key, song);
            return key;
          })
          .filter(Boolean);

    return {
      id: playlist.id || newPlaylistId(),
      name: playlist.name || "Imported Playlist",
      songIds: [...new Set(songIds)],
      createdAt: playlist.createdAt || now,
      updatedAt: playlist.updatedAt || now,
    };
  });

  return { savedSongs: [...library.values()], playlists: migrated };
}

// Accepts a Fretz backup or a plain array of songs.
export function readBackup(data) {
  const rawSongs = Array.isArray(data) ? data : Array.isArray(data?.savedSongs) ? data.savedSongs : [];
  const rawPlaylists = Array.isArray(data?.playlists) ? data.playlists : [];
  const { savedSongs, playlists } = migrateLibrary(
    rawSongs.map(normalizeImportedSong).filter(Boolean),
    rawPlaylists
  );

  return {
    savedSongs,
    playlists,
    progressBySongId: isPlainObject(data?.progressBySongId) ? data.progressBySongId : {},
    transposeBySongId: isPlainObject(data?.transposeBySongId) ? data.transposeBySongId : {},
  };
}

// Incoming items replace existing ones with the same key; everything else is kept.
function mergeBy(current, incoming, keyOf) {
  return [...new Map([...current, ...incoming].map((item) => [keyOf(item), item])).values()];
}

export function mergeLibrary(current, incoming) {
  return {
    savedSongs: mergeBy(current.savedSongs, incoming.savedSongs, getSongKey),
    playlists: mergeBy(current.playlists, incoming.playlists, (playlist) => playlist.id || playlist.name),
    progressBySongId: { ...current.progressBySongId, ...incoming.progressBySongId },
    transposeBySongId: { ...current.transposeBySongId, ...incoming.transposeBySongId },
  };
}
