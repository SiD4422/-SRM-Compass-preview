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
    ),
    {
      name: 'cleanup-disabled-tamil-assets',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          if (process.env.TAMIL_ENABLED !== 'true') {
            const fs = await import('node:fs');
            const astroDir = new URL('_astro/', dir);
            if (fs.existsSync(astroDir)) {
              for (const file of fs.readdirSync(astroDir)) {
                if (file.toLowerCase().includes('tamil')) {
                  fs.unlinkSync(new URL(file, astroDir));
                }
              }
            }
          }
        }
      }
    }
  ],
  vite: {
    plugins: [
      {
        name: 'exclude-tamil-client-bundle',
        generateBundle(options, bundle) {
          if (process.env.TAMIL_ENABLED !== 'true') {
            for (const fileName of Object.keys(bundle)) {
              if (fileName.toLowerCase().includes('tamil')) {
                delete bundle[fileName];
              }
            }
          }
        }
      }
    ]
  }
});

