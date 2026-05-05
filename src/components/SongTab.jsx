import { FiX, FiMusic } from "react-icons/fi";

export default function SongTab({ song, onClose }) {
  return (
    <section className="song-tab-panel">
      <div className="song-tab-header">
        <div className="song-tab-title">
          <div className="song-icon large">
            <FiMusic />
          </div>

          <div>
            {/* <p className="eyebrow">Now Viewing</p> */}
            <h2>{song.title}</h2>
            <p>{song.artist}</p>
          </div>
        </div>

        <button className="close-tab-button" onClick={onClose}>
          <FiX />
        </button>
      </div>

      <div className="tab-meta">
        <span>{song.tuning}</span>
        <span>{song.capo}</span>
        <span>{song.difficulty}</span>
      </div>

      <pre
        className="tab-content"
        style={{ fontSize: `${song.fontSizePx || 14}px` }}
      >
        {song.tab}
      </pre>
      
    </section>
  );
}