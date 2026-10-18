import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://ale0aranda.github.io',
  base: '/github-community-wall',

  vite: {
    plugins: [tailwindcss()]
  }
});
