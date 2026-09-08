import { create } from 'zustand';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('itsm-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (private browsing, blocked) — fall through to system preference
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface UiState {
  theme: Theme;
  navCollapsed: boolean;
  toggleTheme: () => void;
  setNavCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: getInitialTheme(),
  navCollapsed: false,
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('itsm-theme', next);
    } catch {
      // ignore persistence failure — theme still applies for this session
    }
    set({ theme: next });
  },
  setNavCollapsed: (collapsed) => set({ navCollapsed: collapsed }),
}));
