import { useEffect, useState } from "react";
import { readJson, writeJson } from "../utils/storage";
import {
  FiEdit3,
  FiMusic,
  FiStar,
  FiList,
  FiSave,
  FiX,
  FiUser,
  FiMoon,
  FiSun,
} from "react-icons/fi";

function getTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const asArray = (value) => (Array.isArray(value) ? value : []);

const DEFAULT_PROFILE = {
  displayName: "Fretz Player",
  instrument: "Guitar",
  skillLevel: "Beginner",
  bio: "Building my tab library one riff at a time.",
};

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [theme, setTheme] = useState(getTheme);

  function chooseTheme(nextTheme) {
    if (nextTheme === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("fretzTheme", nextTheme);
    } catch {
      // Storage blocked: the theme still applies for this visit.
    }
    setTheme(nextTheme);
  }

  const [profile, setProfile] = useState(() => readJson("fretzProfile", DEFAULT_PROFILE));

  const [profileForm, setProfileForm] = useState(profile);

  // Read once: Home saves these, and Profile only shows counts.
  const [savedSongs] = useState(() => asArray(readJson("savedSongs", [])));
  const [playlists] = useState(() => asArray(readJson("playlists", [])));

  const fretzPicksCount = savedSongs.filter(
    (song) => song.source === "hardcoded"
  ).length;

  const pinnedSongsCount = savedSongs.filter((song) => song.pinned).length;

  useEffect(() => {
    writeJson("fretzProfile", profile);
  }, [profile]);

  function handleStartEdit() {
    setProfileForm(profile);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setProfileForm(profile);
    setIsEditing(false);
  }

  function handleSaveProfile(event) {
    event.preventDefault();

    const cleanedProfile = {
      displayName: profileForm.displayName.trim() || "Fretz Player",
      instrument: profileForm.instrument.trim() || "Guitar",
      skillLevel: profileForm.skillLevel.trim() || "Beginner",
      bio:
        profileForm.bio.trim() ||
        "Building my tab library one riff at a time.",
    };

    setProfile(cleanedProfile);
    setIsEditing(false);
  }

  return (
    <main className="profile-page">
      <section className="profile-hero">
        <div className="profile-avatar">
          <FiUser />
        </div>

        <div className="profile-copy">
          <p className="eyebrow">Profile</p>
          <h1>{profile.displayName}</h1>
          <p>{profile.bio}</p>
        </div>

        {!isEditing && (
          <button className="profile-edit-button" onClick={handleStartEdit}>
            <FiEdit3 />
            <span>Edit</span>
          </button>
        )}
      </section>

      <section className="profile-details-grid">
        <article className="profile-detail-card">
          <FiMusic />
          <span>Instrument</span>
          <strong>{profile.instrument}</strong>
        </article>

        <article className="profile-detail-card">
          <FiStar />
          <span>Skill level</span>
          <strong>{profile.skillLevel}</strong>
        </article>
      </section>

      <section className="profile-stats-section">
        <div className="profile-section-header">
          <h2>Library Stats</h2>
          <p>Your saved Fretz activity on this device.</p>
        </div>

        <div className="profile-stats-grid">
          <article className="profile-stat-card">
            <FiMusic />
            <strong>{savedSongs.length}</strong>
            <span>Saved tabs</span>
          </article>

          <article className="profile-stat-card">
            <FiList />
            <strong>{playlists.length}</strong>
            <span>Playlists</span>
          </article>

          <article className="profile-stat-card">
            <FiStar />
            <strong>{pinnedSongsCount}</strong>
            <span>Pinned songs</span>
          </article>

          <article className="profile-stat-card">
            <span className="profile-crown">♛</span>
            <strong>{fretzPicksCount}</strong>
            <span>Fretz Picks</span>
          </article>
        </div>
      </section>

      <section className="profile-stats-section">
        <div className="profile-section-header">
          <h2>Appearance</h2>
          <p>Choose how Fretz looks on this device.</p>
        </div>

        <div className="theme-switch" role="group" aria-label="Theme">
          <button type="button" aria-pressed={theme === "dark"} onClick={() => chooseTheme("dark")}>
            <FiMoon aria-hidden="true" />
            <span>Dark</span>
          </button>
          <button type="button" aria-pressed={theme === "light"} onClick={() => chooseTheme("light")}>
            <FiSun aria-hidden="true" />
            <span>Light</span>
          </button>
        </div>
      </section>

      {isEditing && (
        <section className="profile-edit-section">
          <div className="profile-section-header">
            <h2>Edit Profile</h2>
            <p>Customize how your Fretz profile looks.</p>
          </div>

          <form className="profile-form" onSubmit={handleSaveProfile}>
            <label>
              Display name
              <input
                value={profileForm.displayName}
                onChange={(event) =>
                  setProfileForm((currentForm) => ({
                    ...currentForm,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Favorite instrument
              <input
                value={profileForm.instrument}
                onChange={(event) =>
                  setProfileForm((currentForm) => ({
                    ...currentForm,
                    instrument: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Skill level
              <select
                value={profileForm.skillLevel}
                onChange={(event) =>
                  setProfileForm((currentForm) => ({
                    ...currentForm,
                    skillLevel: event.target.value,
                  }))
                }
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
                <option>Professional</option>
              </select>
            </label>

            <label>
              Bio
              <textarea
                value={profileForm.bio}
                onChange={(event) =>
                  setProfileForm((currentForm) => ({
                    ...currentForm,
                    bio: event.target.value,
                  }))
                }
              />
            </label>

            <div className="profile-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancelEdit}
              >
                <FiX />
                <span>Cancel</span>
              </button>

              <button type="submit" className="primary-button">
                <FiSave />
                <span>Save profile</span>
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}