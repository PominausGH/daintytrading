import { defineCollection, z } from 'astro:content';

const chip = z.object({ label: z.string(), value: z.string() });
const link = z.object({ label: z.string(), href: z.string() });
const sidecard = z.object({
  heading: z.string().default('Project facts'),
  rows: z.array(chip),
  primaryCta: link.optional(),
  ghostCta: link.optional(),
});
const screenshot = z.object({
  image: z.string(),
  imageWebp: z.string().optional(),
  alt: z.string(),
  url: z.string().optional(), // external link the screenshot mock wraps, if any
});

// projects/ URL space (/projects/<slug>.html) holds two kinds of entries that share
// one page shell (hero, optional screenshot, prose body, sidecard, CTA banner, next/prev
// nav) but differ in JSON-LD type: internal SaaS product showcases, and real client
// SEO/GEO case studies. Structured template pieces (chips, sidecard, CTA banner, nav)
// are frontmatter; prose (the h2 sections) is the markdown body.
const projectBase = {
  name: z.string(),
  title: z.string(), // exact <title> text — often more keyword-specific than `name`, don't derive it
  description: z.string(), // meta description
  ogTitle: z.string(),
  ogDescription: z.string(),
  ogImage: z.string(),
  lede: z.string(),
  metaChips: z.array(chip),
  screenshot: screenshot.optional(),
  sidecard,
  ctaBannerHeading: z.string(),
  ctaBannerBody: z.string(),
  prevLink: link.optional(),
  nextLink: link.optional(),
};

const projects = defineCollection({
  type: 'content',
  schema: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('product'),
      status: z.enum(['live', 'testing', 'dev']), // single source of truth for the work.astro grouping and the portfolio counts quoted across other pages — see src/data/products.ts
      unlisted: z.boolean().optional(), // true = page still builds but is noindex, out of sitemap/listings/counts (kept for reversibility)
      schemaType: z.string(), // JSON-LD @type, e.g. "SoftwareApplication", "EducationalOrganization"
      schemaExtra: z.record(z.any()).optional(), // extra JSON-LD fields beyond @context/@type/name/description
      ...projectBase,
    }),
    z.object({
      type: z.literal('case-study'),
      client: z.string(),
      schemaExtra: z.record(z.any()).optional(),
      ...projectBase,
    }),
  ]),
});

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    publishedDate: z.coerce.date(),
    readTime: z.string(), // e.g. "4 min", as shown on every post + the blog index card
    ogImage: z.string().default('https://telaloom.com/og-card.jpg'),
  }),
});

export const collections = { projects, blog };
