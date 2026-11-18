import { describeVoicing, extractChords, getChordVoicing, isStandardTuning } from "../utils/chords";

const STRING_GAP = 12;
const FRET_GAP = 15;
const PAD_X = 10;
const PAD_TOP = 16;
const DOT_R = 5;

function ChordDiagram({ name, voicing }) {
  const { frets, fingers } = voicing;
  const fretted = frets.filter((fret) => fret > 0);
  const maxFret = Math.max(0, ...fretted);
  const baseFret = maxFret <= 4 ? 1 : Math.min(...fretted);
  const rows = Math.max(4, maxFret - baseFret + 1);
  const width = PAD_X * 2 + STRING_GAP * 5 + 14;
  const height = PAD_TOP + rows * FRET_GAP + 6;
  const x = (string) => PAD_X + string * STRING_GAP;
  const y = (fret) => PAD_TOP + (fret - baseFret + 0.5) * FRET_GAP;

  // A finger on several strings at one fret is a barre.
  const barres = [1, 2, 3, 4].flatMap((finger) => {
    const strings = fingers ? frets.flatMap((_, s) => (fingers[s] === finger ? [s] : [])) : [];
    return strings.length > 1 ? [{ finger, from: strings[0], to: strings.at(-1), fret: frets[strings[0]] }] : [];
  });

  return (
    <svg
      className="chord-diagram"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={describeVoicing(name, voicing)}
    >
      {Array.from({ length: rows + 1 }, (_, row) => (
        <line
          key={`fret-${row}`}
          className={row === 0 && baseFret === 1 ? "chord-nut" : "chord-fret"}
          x1={x(0)}
          x2={x(5)}
          y1={PAD_TOP + row * FRET_GAP}
          y2={PAD_TOP + row * FRET_GAP}
        />
      ))}
      {frets.map((_, string) => (
        <line key={`string-${string}`} className="chord-string" x1={x(string)} x2={x(string)} y1={PAD_TOP} y2={PAD_TOP + rows * FRET_GAP} />
      ))}
      {baseFret > 1 && (
        <text className="chord-base-fret" x={x(5) + 8} y={y(baseFret) + 3}>
          {baseFret}fr
        </text>
      )}
      {frets.map((fret, string) =>
        fret === null ? (
          <path key={`m-${string}`} className="chord-muted" d={`M${x(string) - 3} 4l6 6m0 -6l-6 6`} />
        ) : fret === 0 ? (
          <circle key={`o-${string}`} className="chord-open" cx={x(string)} cy={7} r={3} />
        ) : null
      )}
      {barres.map((barre) => (
        <rect
          key={`barre-${barre.finger}`}
          className="chord-dot"
          x={x(barre.from) - DOT_R}
          y={y(barre.fret) - DOT_R}
          width={x(barre.to) - x(barre.from) + DOT_R * 2}
          height={DOT_R * 2}
          rx={DOT_R}
        />
      ))}
      {frets.map((fret, string) =>
        fret > 0 ? (
          <g key={`f-${string}`}>
            <circle className="chord-dot" cx={x(string)} cy={y(fret)} r={DOT_R} />
            {fingers?.[string] > 0 && (
              <text className="chord-finger" x={x(string)} y={y(fret) + 2.5}>
                {fingers[string]}
              </text>
            )}
          </g>
        ) : null
      )}
    </svg>
  );
}

export default function ChordDiagrams({ song }) {
  const chords = extractChords(song.tab);
  const standard = isStandardTuning(song.tuning);
  const capo = (song.capo || "").trim();
  const hasCapo = capo && !/^(no capo|none|0)$/i.test(capo);

  return (
    <section className="chord-panel" aria-labelledby="chord-panel-title">
      <h3 id="chord-panel-title">Chords</h3>

      {chords.length === 0 ? (
        <p className="chord-panel-note">No chords detected in this tab.</p>
      ) : (
        <>
          {!standard && (
            <p className="chord-panel-note">
              Diagrams are for standard tuning (E A D G B E), so they are hidden for this song's
              tuning ({song.tuning}).
            </p>
          )}
          {standard && hasCapo && (
            <p className="chord-panel-note">
              {/capo/i.test(capo) ? capo : `Capo ${capo}`}: fret numbers are relative to the capo.
            </p>
          )}

          <ul className="chord-grid">
            {chords.map((name) => {
              const voicing = standard ? getChordVoicing(name) : null;
              return (
                <li className="chord-card" key={name}>
                  <span className="chord-name">{name}</span>
                  {voicing ? (
                    <ChordDiagram name={name} voicing={voicing} />
                  ) : (
                    standard && <span className="chord-unavailable">Diagram unavailable</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
