import { defineConfig } from 'astro/config';

// Sitemap is NOT generated via @astrojs/sitemap — that integration outputs
// sitemap-index.xml/sitemap-0.xml, but every page's <link rel="sitemap"> and
// robots.txt already point at the exact URL /sitemap.xml, and Google has that
// URL indexed. Instead src/pages/sitemap.xml.ts is a custom endpoint that
// enumerates real routes at build time and emits classic /sitemap.xml directly.
export default defineConfig({
  site: 'https://telaloom.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file', // keep /foo.html output paths, not /foo/index.html — preserves every existing URL
  },
});
