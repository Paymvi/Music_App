export async function searchSongs(query, options = {}) {
  const cleanedQuery = query.trim();

  if (!cleanedQuery) {
    return [];
  }

  const encodedQuery = encodeURIComponent(cleanedQuery);

  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodedQuery}&media=music&entity=song&limit=12`,
    {
      signal: options.signal,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to search songs.");
  }

  const data = await response.json();

  return (data.results || []).map((track) => {
    const artworkUrl =
      track.artworkUrl100?.replace("100x100bb", "600x600bb") || "";

    return {
      id: `itunes-${track.trackId}`,
      title: track.trackName || "Untitled Song",
      artist: track.artistName || "Unknown Artist",
      album: track.collectionName || "",
      tuning: "Standard",
      difficulty: "Beginner",
      capo: "No capo",
      imageUrl: artworkUrl,
      source: "itunes",
      fontSizePx: 14,
      tab: `[${track.trackName || "Song"}]

Add your chords or tab here.

Example:

[Intro]
G  D  Em  C

[Verse]
G
Write your lyrics/chords here`,
    };
  });
}