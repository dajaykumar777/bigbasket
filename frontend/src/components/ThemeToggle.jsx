import React from 'react';
import { useTheme } from '../hooks/useTheme';

const OPTIONS = [
  { value: 'light',  icon: '☀️', label: 'Light'  },
  { value: 'system', icon: '💻', label: 'System' },
  { value: 'dark',   icon: '🌙', label: 'Dark'   },
];

export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`theme-toggle${compact ? ' theme-toggle--compact' : ''}`} role="group" aria-label="Theme">
      {OPTIONS.map(({ value, icon, label }) => (
        <button
          key={value}
          className={`theme-toggle__btn${theme === value ? ' theme-toggle__btn--active' : ''}`}
          onClick={() => setTheme(value)}
          title={label}
          aria-pressed={theme === value}
        >
          <span className="theme-toggle__icon">{icon}</span>
          {!compact && <span className="theme-toggle__label">{label}</span>}
        </button>
      ))}
    </div>
  );
}
