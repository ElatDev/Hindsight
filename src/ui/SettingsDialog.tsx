import { useState } from 'react';
import {
  ANALYSIS_DEPTH_MAX,
  ANALYSIS_DEPTH_MIN,
  type BoardTheme,
  type PieceTheme,
  type Settings,
} from './useSettings';
import type { Theme } from './useTheme';

export type SettingsDialogProps = {
  initial: Settings;
  theme: Theme;
  onConfirm: (next: Settings, theme: Theme) => void;
  onReset: () => void;
  onCancel: () => void;
};

const BOARD_THEME_LABEL: Record<BoardTheme, string> = {
  classic: 'Classic brown',
  blue: 'Blue',
  green: 'Green',
  gray: 'Gray',
};

const PIECE_THEME_LABEL: Record<PieceTheme, string> = {
  cburnett: 'Cburnett',
  merida: 'Merida',
  alpha: 'Alpha',
};

const PIECE_SET_PENDING_NOTE =
  'Saved now; piece-set bundles ship in a follow-up release.';

/**
 * Settings dialog (Phase 12 / Task 1). The dialog ships the foundational
 * surface for app-wide preferences. A few fields drive working features
 * already (analysis depth, theme); the rest persist and will be consumed by
 * later Phase 12 tasks (live eval bar in Task 7, board/piece theming in
 * Task 8). Each pending field is labelled so the user knows it's parked.
 */
export function SettingsDialog({
  initial,
  theme,
  onConfirm,
  onReset,
  onCancel,
}: SettingsDialogProps): JSX.Element {
  const [analysisDepth, setAnalysisDepth] = useState(initial.analysisDepth);
  const [liveEval, setLiveEval] = useState(initial.liveEval);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(initial.boardTheme);
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>(initial.pieceTheme);
  const [themeChoice, setThemeChoice] = useState<Theme>(theme);

  const submit = (): void => {
    onConfirm({ analysisDepth, liveEval, boardTheme, pieceTheme }, themeChoice);
  };

  const restoreDefaults = (): void => {
    onReset();
  };

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="dialog dialog--wide">
        <h2 id="settings-title">Settings</h2>

        <fieldset className="dialog__field">
          <legend>Analysis depth</legend>
          <div className="dialog__elo">
            <input
              type="range"
              min={ANALYSIS_DEPTH_MIN}
              max={ANALYSIS_DEPTH_MAX}
              step={1}
              value={analysisDepth}
              onChange={(e) => setAnalysisDepth(Number(e.target.value))}
            />
            <span className="dialog__elo-value">{analysisDepth}</span>
          </div>
          <p className="settings__hint">
            Stockfish search depth used by the review pipeline. Higher is slower
            but more accurate.
          </p>
        </fieldset>

        <fieldset className="dialog__field">
          <legend>Theme</legend>
          <label>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={themeChoice === 'dark'}
              onChange={() => setThemeChoice('dark')}
            />
            Dark
          </label>
          <label>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={themeChoice === 'light'}
              onChange={() => setThemeChoice('light')}
            />
            Light
          </label>
        </fieldset>

        <fieldset className="dialog__field">
          <legend>Live evaluation during play</legend>
          <label>
            <input
              type="checkbox"
              checked={liveEval}
              onChange={(e) => setLiveEval(e.target.checked)}
            />
            Show eval bar updates while playing
          </label>
          <p className="settings__hint settings__hint--pending">
            Saved now; the live eval feature itself ships in a later Phase 12
            task. Until then this only records your preference.
          </p>
        </fieldset>

        <fieldset className="dialog__field">
          <legend>Board theme</legend>
          {(Object.keys(BOARD_THEME_LABEL) as BoardTheme[]).map((key) => (
            <label key={key}>
              <input
                type="radio"
                name="boardTheme"
                value={key}
                checked={boardTheme === key}
                onChange={() => setBoardTheme(key)}
              />
              {BOARD_THEME_LABEL[key]}
            </label>
          ))}
        </fieldset>

        <fieldset className="dialog__field">
          <legend>Piece set</legend>
          {(Object.keys(PIECE_THEME_LABEL) as PieceTheme[]).map((key) => (
            <label key={key}>
              <input
                type="radio"
                name="pieceTheme"
                value={key}
                checked={pieceTheme === key}
                onChange={() => setPieceTheme(key)}
              />
              {PIECE_THEME_LABEL[key]}
            </label>
          ))}
          <p className="settings__hint settings__hint--pending">
            {PIECE_SET_PENDING_NOTE}
          </p>
        </fieldset>

        <div className="dialog__actions">
          <button type="button" onClick={restoreDefaults}>
            Restore defaults
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="dialog__primary" onClick={submit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
