import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Replaces the old hand-maintained sitemap.xml (plus Ghost Writer's append-on-publish
// step). Generated at build time from real routes, so it can never drift the way the
// old file did — no page can be forgotten, no dead URL can linger.
const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/work.html', changefreq: 'weekly', priority: '0.9' },
  { path: '/services.html', changefreq: 'monthly', priority: '0.9' },
  { path: '/about.html', changefreq: 'monthly', priority: '0.8' },
  { path: '/contact.html', changefreq: 'monthly', priority: '0.9' },
  { path: '/blog.html', changefreq: 'weekly', priority: '0.8' },
  { path: '/review.html', changefreq: 'monthly', priority: '0.4' },
  { path: '/australia.html', changefreq: 'monthly', priority: '0.6' },
  { path: '/uk.html', changefreq: 'monthly', priority: '0.6' },
  { path: '/usa.html', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/services/ai-product-builds.html', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/ai-automation-retrofit.html', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/ai-infrastructure.html', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/seo-geo-optimization.html', changefreq: 'monthly', priority: '0.9' },
  { path: '/services/local-seo.html', changefreq: 'monthly', priority: '0.9' },
  { path: '/services/website-builds.html', changefreq: 'monthly', priority: '0.9' },
];

export const GET: APIRoute = async () => {
  const buildDate = new Date().toISOString().slice(0, 10);
  const projects = await getCollection('projects');
  const posts = await getCollection('blog');

  const urls = [
    ...STATIC_PAGES.map((p) => ({
      loc: `https://telaloom.com${p.path}`,
      lastmod: buildDate,
      changefreq: p.changefreq,
      priority: p.priority,
    })),
    ...projects.map((entry) => ({
      loc: `https://telaloom.com/projects/${entry.slug}.html`,
      lastmod: buildDate,
      changefreq: 'monthly',
      priority: entry.data.type === 'case-study' ? '0.8' : '0.7',
    })),
    ...posts.map((entry) => ({
      loc: `https://telaloom.com/blog/${entry.slug}.html`,
      lastmod: entry.data.publishedDate.toISOString().slice(0, 10),
      changefreq: 'monthly',
      priority: '0.6',
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
