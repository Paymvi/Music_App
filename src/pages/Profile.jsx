import { useEffect, useMemo, useState } from "react";
import {
  FiEdit3,
  FiMusic,
  FiStar,
  FiList,
  FiSave,
  FiX,
  FiUser,
} from "react-icons/fi";

const DEFAULT_PROFILE = {
  displayName: "Fretz Player",
  instrument: "Guitar",
  skillLevel: "Beginner",
  bio: "Building my tab library one riff at a time.",
};

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);

  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fretzProfile")) || DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [profileForm, setProfileForm] = useState(profile);

  const savedSongs = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("savedSongs")) || [];
    } catch {
      return [];
    }
  }, []);

  const playlists = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("playlists")) || [];
    } catch {
      return [];
    }
  }, []);

  const fretzPicksCount = savedSongs.filter(
    (song) => song.source === "hardcoded"
  ).length;

  const pinnedSongsCount = savedSongs.filter((song) => song.pinned).length;

  useEffect(() => {
    localStorage.setItem("fretzProfile", JSON.stringify(profile));
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