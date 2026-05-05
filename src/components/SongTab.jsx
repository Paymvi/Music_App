import { useEffect, useRef, useState } from "react";
import { FiX, FiMusic, FiPlay, FiPause, FiRotateCcw } from "react-icons/fi";

export default function SongTab({ song, onClose }) {
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30);

  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    if (!isAutoScrolling) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = null;
      lastTimeRef.current = null;
      return;
    }

    function scrollStep(timestamp) {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const pixelsToScroll = (scrollSpeed * deltaTime) / 1000;

      window.scrollBy({
        top: pixelsToScroll,
        behavior: "auto",
      });

      const reachedBottom =
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;

      if (reachedBottom) {
        setIsAutoScrolling(false);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(scrollStep);
    }

    animationFrameRef.current = requestAnimationFrame(scrollStep);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAutoScrolling, scrollSpeed]);

  function toggleAutoScroll() {
    setIsAutoScrolling((currentValue) => !currentValue);
  }

  function resetScroll() {
    setIsAutoScrolling(false);

    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 0);
  }

  function handleClose() {
    setIsAutoScrolling(false);
    onClose();
  }

  return (
    <section className="song-tab-panel">
      <div className="song-tab-header">
        <div className="song-tab-title">
          <div className="song-icon large">
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

          <div>
            <p className="eyebrow">Now Viewing</p>
            <h2>{song.title}</h2>
            <p>{song.artist}</p>
          </div>
        </div>

        <button className="close-tab-button" onClick={handleClose}>
          <FiX />
        </button>
      </div>

      <div className="tab-meta">
        <span>{song.tuning}</span>
        <span>{song.capo}</span>
        <span>{song.difficulty}</span>
      </div>

      <div className="autoscroll-controls">
        <button className="autoscroll-button" onClick={toggleAutoScroll}>
          {isAutoScrolling ? <FiPause /> : <FiPlay />}
          <span>{isAutoScrolling ? "Pause" : "Auto-scroll"}</span>
        </button>

        <button className="autoscroll-button secondary" onClick={resetScroll}>
          <FiRotateCcw />
          <span>Reset</span>
        </button>

        <label className="speed-control">
          <span>Speed</span>

          <input
            type="range"
            min="10"
            max="120"
            step="5"
            value={scrollSpeed}
            onChange={(event) => setScrollSpeed(Number(event.target.value))}
          />

          <strong>{scrollSpeed}</strong>
        </label>
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