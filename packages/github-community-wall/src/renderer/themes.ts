import type { AvatarGridOptions } from '../types/render.js';

export interface Theme {
  background: string;
  foreground: string;
}

const themes: Record<string, Theme> = {
  'github-light': { background: '#f6f8fa', foreground: '#24292f' },
  neon: { background: '#090014', foreground: '#f0abfc' },
  minimal: { background: '#ffffff', foreground: '#111827' },
  'github-dark': { background: '#0d1117', foreground: '#f0f6fc' },
  undefined: { background: 'transparent', foreground: '#ffffff' }
};

export const getTheme = (theme: AvatarGridOptions['theme']): Theme =>
  themes[theme ?? 'undefined'];

export const registerTheme = (name: string, theme: Theme): void => {
  themes[name] = theme;
};
