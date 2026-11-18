// localStorage can throw: blocked by browser settings, or full (about 5 MB per site).
let warned = false;

export function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save ${key}:`, error);
    if (!warned) {
      warned = true;
      alert("Fretz could not save to this browser's storage. It may be full or blocked. Export a backup to keep your changes.");
    }
  }
}
