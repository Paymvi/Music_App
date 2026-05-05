export async function fetchAlbumArt(songTitle, artistName) {
  const query = encodeURIComponent(`${songTitle} ${artistName}`);

  const response = await fetch(
    `https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=1`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch album art.");
  }

  const data = await response.json();

  const result = data.results?.[0];

  if (!result?.artworkUrl100) {
    return null;
  }

  // Upgrade image size when possible.
  return result.artworkUrl100.replace("100x100bb", "600x600bb");
}