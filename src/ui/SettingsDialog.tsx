import { useState } from 'react';
import {
  ANALYSIS_DEPTH_MAX,
  ANALYSIS_DEPTH_MIN,
  DEFAULT_SETTINGS,
  type BoardTheme,
  type PieceTheme,
  type Settings,
} from './useSettings';
import { DEFAULT_THEME, type Theme } from './useTheme';

export type SettingsDialogProps = {
  initial: Settings;
  theme: Theme;
  onConfirm: (next: Settings, theme: Theme) => void;
  onCancel: () => void;
};

const BOARD_THEME_LABEL: Record<BoardTheme, string> = {
  classic: 'Classic brown',
  blue: 'Blue',
  green: 'Green',
  gray: 'Gray',
  walnut: 'Walnut',
  rose: 'Rose',
  ocean: 'Ocean',
  midnight: 'Midnight',
  mint: 'Mint',
};

const PIECE_THEME_LABEL: Record<PieceTheme, string> = {
  cburnett: 'Cburnett',
  merida: 'Merida',
  alpha: 'Alpha',
};

const PIECE_SET_PENDING_NOTE =
  'Preview only — the Cburnett set ships today; Merida and Alpha are bundled in a future release. Selecting one now records the preference but the on-board pieces stay Cburnett.';

/**
 * Settings dialog. Drives every persisted preference: analysis depth, light /
 * dark theme, the live-eval-during-play toggle, board palette, and (parked)
 * piece-set choice. Selecting "Restore defaults" repopulates the form fields
 * locally; nothing persists to disk until the user clicks "Save".
 */
export function SettingsDialog({
  initial,
  theme,
  onConfirm,
  onCancel,
}: SettingsDialogProps): JSX.Element {
  const [analysisDepth, setAnalysisDepth] = useState(initial.analysisDepth);
  const [liveEval, setLiveEval] = useState(initial.liveEval);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(initial.boardTheme);
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>(initial.pieceTheme);
  const [autoQueen, setAutoQueen] = useState(initial.autoQueen);
  const [themeChoice, setThemeChoice] = useState<Theme>(theme);

  const submit = (): void => {
    onConfirm(
      { analysisDepth, liveEval, boardTheme, pieceTheme, autoQueen },
      themeChoice,
    );
  };

  // "Restore defaults" used to call back into the parent and persist the
  // reset immediately, but the dialog's own form state didn't refresh — so a
  // subsequent Save would overwrite the defaults with whatever the user had
  // before, and a subsequent Cancel would orphan the persisted defaults. The
  // reset now lives entirely in the dialog: it pulls every field back to
  // `DEFAULT_SETTINGS` (and dark theme) without persisting anything until
  // the user explicitly clicks Save.
  const restoreDefaults = (): void => {
    setAnalysisDepth(DEFAULT_SETTINGS.analysisDepth);
    setLiveEval(DEFAULT_SETTINGS.liveEval);
    setBoardTheme(DEFAULT_SETTINGS.boardTheme);
    setPieceTheme(DEFAULT_SETTINGS.pieceTheme);
    setAutoQueen(DEFAULT_SETTINGS.autoQueen);
    setThemeChoice(DEFAULT_THEME);
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
            Stockfish search depth used by the review pipeline. Each step up
            roughly doubles per-move analysis time. The default of 10 is a good
            balance for casual review; tournament-quality analysis wants 14+.
            Parallel-engine review is on the v0.2 roadmap; until then, lowering
            this is the simplest way to speed things up.
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
          <p className="settings__hint">
            When on, Stockfish runs in the background as you play and the eval
            bar updates after each move. Turn off to keep play "blind" — the
            review still works the same either way.
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

        <fieldset className="dialog__field">
          <legend>Pawn promotion</legend>
          <label>
            <input
              type="checkbox"
              checked={autoQueen}
              onChange={(e) => setAutoQueen(e.target.checked)}
            />
            Always promote to queen automatically
          </label>
          <p className="settings__hint">
            When off, dragging a pawn to its last rank pops up a picker so you
            can under-promote (knight, bishop, rook). Most games want auto-
            queen; tactical puzzles and the rare endgame need the picker.
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
