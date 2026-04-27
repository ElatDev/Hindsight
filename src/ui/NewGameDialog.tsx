import { useState } from 'react';
import type { Color } from '../chess/game';

export type GameMode = 'free' | 'vs-engine';

export type NewGameSettings = {
  mode: GameMode;
  /** Only meaningful when mode === 'vs-engine'. */
  playerColor: Color;
  /** Only meaningful when mode === 'vs-engine'. Range 1320..3190. */
  elo: number;
};

export type NewGameDialogProps = {
  initial?: Partial<NewGameSettings>;
  onConfirm: (settings: NewGameSettings) => void;
  onCancel: () => void;
};

const ELO_MIN = 1320;
const ELO_MAX = 3190;

export function NewGameDialog({
  initial,
  onConfirm,
  onCancel,
}: NewGameDialogProps): JSX.Element {
  const [mode, setMode] = useState<GameMode>(initial?.mode ?? 'vs-engine');
  const [playerColor, setPlayerColor] = useState<Color | 'random'>(
    initial?.playerColor ?? 'w',
  );
  const [elo, setElo] = useState<number>(initial?.elo ?? 1500);

  const submit = (): void => {
    const resolvedColor: Color =
      playerColor === 'random'
        ? Math.random() < 0.5
          ? 'w'
          : 'b'
        : playerColor;
    onConfirm({ mode, playerColor: resolvedColor, elo });
  };

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-game-title"
    >
      <div className="dialog">
        <h2 id="new-game-title">New game</h2>

        <fieldset className="dialog__field">
          <legend>Mode</legend>
          <label>
            <input
              type="radio"
              name="mode"
              value="vs-engine"
              checked={mode === 'vs-engine'}
              onChange={() => setMode('vs-engine')}
            />
            Play vs engine
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="free"
              checked={mode === 'free'}
              onChange={() => setMode('free')}
            />
            Free play / manual entry (no engine)
          </label>
        </fieldset>

        <fieldset className="dialog__field" disabled={mode !== 'vs-engine'}>
          <legend>Your color</legend>
          <label>
            <input
              type="radio"
              name="color"
              value="w"
              checked={playerColor === 'w'}
              onChange={() => setPlayerColor('w')}
            />
            White
          </label>
          <label>
            <input
              type="radio"
              name="color"
              value="b"
              checked={playerColor === 'b'}
              onChange={() => setPlayerColor('b')}
            />
            Black
          </label>
          <label>
            <input
              type="radio"
              name="color"
              value="random"
              checked={playerColor === 'random'}
              onChange={() => setPlayerColor('random')}
            />
            Random
          </label>
        </fieldset>

        <fieldset className="dialog__field" disabled={mode !== 'vs-engine'}>
          <legend>Engine strength (Elo)</legend>
          <div className="dialog__elo">
            <input
              type="range"
              min={ELO_MIN}
              max={ELO_MAX}
              step={20}
              value={elo}
              onChange={(e) => setElo(Number(e.target.value))}
            />
            <span className="dialog__elo-value">{elo}</span>
          </div>
        </fieldset>

        <div className="dialog__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="dialog__primary" onClick={submit}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
