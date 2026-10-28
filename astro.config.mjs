import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://srm-compass.spartensid12.workers.dev',
  output: 'static',
  integrations: [sitemap()]
});
