import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'bb-theme';

function applyTheme(preference) {
  const root = document.documentElement;
  if (preference === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (preference === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // 'system' — let CSS media query decide
    root.removeAttribute('data-theme');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  });

  // Apply on mount + whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
