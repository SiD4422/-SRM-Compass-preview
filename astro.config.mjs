import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://srm-compass.spartensid12.workers.dev',
  output: 'static',
  integrations: [
    sitemap(
      process.env.TAMIL_ENABLED === 'true'
        ? {
            i18n: {
              defaultLocale: 'en',
              locales: {
                en: 'en',
                ta: 'ta'
              }
            }
          }
        : undefined
    )
  ]
});
