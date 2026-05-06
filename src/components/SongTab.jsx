import { useEffect, useRef, useState } from "react";
import { FiX, FiMusic, FiPlay, FiPause, FiRotateCcw } from "react-icons/fi";


// [Intro]       purple section heading
// G D/F# Em C   yellow chord line
// (Play softly) muted italic note
// lyrics        normal white text
// tab lines     purple mono tab styling

function isChordToken(token) {
  return /^([A-G](#|b)?(maj|min|m|dim|aug|sus|add)?\d*(\/[A-G](#|b)?)?|N\.?C\.?)$/i.test(
    token.trim()
  );
}

function isChordLine(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine) return false;

  const tokens = trimmedLine.split(/\s+/);

  return tokens.length > 0 && tokens.every(isChordToken);
}

function isSectionLine(line) {
  return /^\s*\[[^\]]+\]\s*$/.test(line);
}

function isNoteLine(line) {
  return /^\s*\([^)]*\)\s*$/.test(line);
}

function isTabLine(line) {
  return /^\s*[eBGDAE]\|/.test(line) || /^\s*[|/\-0-9hbp~x\s]+$/.test(line);
}

function renderChordLine(line, lineIndex) {
  const pieces = line.split(/(\s+)/);

  return pieces.map((piece, pieceIndex) => {
    if (/^\s+$/.test(piece)) {
      return piece;
    }

    if (isChordToken(piece)) {
      return (
        <span className="rendered-chord" key={`${lineIndex}-${pieceIndex}`}>
          {piece}
        </span>
      );
    }

    return piece;
  });
}

function renderInlineText(line, lineIndex) {
  const pieces = line.split(/(\[[^\]]+\]|\([^)]*\))/g);

  return pieces.map((piece, pieceIndex) => {
    if (/^\[[^\]]+\]$/.test(piece)) {
      const insideBrackets = piece.slice(1, -1);

      if (isChordToken(insideBrackets)) {
        return (
          <span className="rendered-chord" key={`${lineIndex}-${pieceIndex}`}>
            {insideBrackets}
          </span>
        );
      }

      return (
        <span className="rendered-section-inline" key={`${lineIndex}-${pieceIndex}`}>
          {piece}
        </span>
      );
    }

    if (/^\([^)]*\)$/.test(piece)) {
      return (
        <span className="rendered-note-inline" key={`${lineIndex}-${pieceIndex}`}>
          {piece}
        </span>
      );
    }

    return piece;
  });
}

function renderTabLine(line, lineIndex) {
  if (!line.trim()) {
    return <div className="rendered-empty-line" key={lineIndex} />;
  }

  if (isSectionLine(line)) {
    return (
      <div className="rendered-section-line" key={lineIndex}>
        {line.trim()}
      </div>
    );
  }

  if (isNoteLine(line)) {
    return (
      <div className="rendered-note-line" key={lineIndex}>
        {line.trim()}
      </div>
    );
  }

  if (isChordLine(line)) {
    return (
      <div className="rendered-chord-line" key={lineIndex}>
        {renderChordLine(line, lineIndex)}
      </div>
    );
  }

  if (isTabLine(line)) {
    return (
      <div className="rendered-guitar-tab-line" key={lineIndex}>
        {line}
      </div>
    );
  }

  return (
    <div className="rendered-lyric-line" key={lineIndex}>
      {renderInlineText(line, lineIndex)}
    </div>
  );
}

export default function SongTab({ song, onClose }) {
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const [isStyledView, setIsStyledView] = useState(true);

  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  const tabLines = (song.tab || "").split("\n");

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

          <div className="song-tab-copy">
            <p className="eyebrow">Now Viewing</p>

            <div className="song-tab-title-row">
              <h2>{song.title}</h2>

              {song.source === "hardcoded" && (
                <span className="hardcoded-tag">♛ Fretz Pick</span>
              )}
            </div>

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

        <button
          className={
            isStyledView
              ? "autoscroll-button secondary view-toggle-active"
              : "autoscroll-button secondary"
          }
          onClick={() => setIsStyledView((currentValue) => !currentValue)}
        >
          <span>{isStyledView ? "Styled view" : "Plain view"}</span>
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

      {isStyledView ? (
        <div
          className="rendered-tab-content"
          style={{ fontSize: `${song.fontSizePx || 14}px` }}
        >
          {tabLines.map((line, lineIndex) => renderTabLine(line, lineIndex))}
        </div>
      ) : (
        <pre
          className="tab-content"
          style={{ fontSize: `${song.fontSizePx || 14}px` }}
        >
          {song.tab}
        </pre>
      )}
    </section>
  );
}