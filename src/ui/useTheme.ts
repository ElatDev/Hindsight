import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'hindsight.theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  const prefersLight = window.matchMedia(
    '(prefers-color-scheme: light)',
  ).matches;
  return prefersLight ? 'light' : 'dark';
}

/**
 * Theme state hook. Reads initial value from localStorage, falling back to
 * the OS-level `prefers-color-scheme`. Writes the active theme to
 * `<html data-theme="...">` so CSS can switch via a single attribute selector,
 * and persists changes to localStorage.
 */
export function useTheme(): {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme): void => {
    setThemeState(next);
  }, []);

  const toggle = useCallback((): void => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle, setTheme };
}
