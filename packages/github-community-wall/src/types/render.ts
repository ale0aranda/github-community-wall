import type { UserFilterType } from './user.js';

export interface AvatarGridOptions {
  columns: number;
  imageSize: number;
  background?: string | undefined;
  gap?: number | undefined;
  shape?: 'square' | 'circle' | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  format?: 'png' | 'jpeg' | 'webp' | 'svg' | 'html' | 'json' | undefined;
  excludeBots?: boolean | undefined;
  sort?: 'login' | 'contributions' | 'none' | undefined;
  theme?: 'github-dark' | 'github-light' | 'neon' | 'minimal' | undefined;
  watermark?: string | undefined;
  filterType?: UserFilterType | undefined;
  includeLoginPattern?: string | undefined;
  excludeLoginPattern?: string | undefined;
  minContributions?: number | undefined;
  maxContributions?: number | undefined;
  minFollowers?: number | undefined;
  maxFollowers?: number | undefined;
}

export interface TwitterBannerOptions {
  imageSize: number;
  background?: string | undefined;
  gap?: number | undefined;
  shape?: 'square' | 'circle' | undefined;
  format?: 'png' | 'jpeg' | 'webp' | 'svg' | undefined;
  theme?: AvatarGridOptions['theme'];
  watermark?: string | undefined;
}
