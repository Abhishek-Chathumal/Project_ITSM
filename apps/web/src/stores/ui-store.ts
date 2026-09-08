import { create } from 'zustand';

type Theme = 'light' | 'dark';

const THEME_KEY = 'itsm-theme';
const NAV_KEY = 'itsm-nav-collapsed';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (private browsing, blocked) — fall through to system preference
  }
  // matchMedia is missing under jsdom and in any non-browser host. This module is
  // imported at load by every component that touches UI state, so an unguarded call
  // takes the whole app down rather than just losing a colour preference.
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialNavCollapsed(): boolean {
  try {
    return localStorage.getItem(NAV_KEY) === 'true';
  } catch {
    return false;
  }
}

interface UiState {
  theme: Theme;
  /** Desktop only: the sidebar is collapsed to an icon rail. Persisted. */
  navCollapsed: boolean;
  /** Mobile only: the sidebar is open as an overlay drawer. Never persisted — a drawer
   *  that reopens itself on every page load would be a nuisance. */
  mobileNavOpen: boolean;
  toggleTheme: () => void;
  toggleNavCollapsed: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: getInitialTheme(),
  navCollapsed: getInitialNavCollapsed(),
  mobileNavOpen: false,

  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore persistence failure — theme still applies for this session
    }
    set({ theme: next });
  },

  toggleNavCollapsed: () => {
    const next = !get().navCollapsed;
    try {
      localStorage.setItem(NAV_KEY, String(next));
    } catch {
      // ignore persistence failure — the choice still applies for this session
    }
    set({ navCollapsed: next });
  },

  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));
