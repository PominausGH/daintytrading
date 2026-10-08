import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'blog'>;

const STOP = new Set(['the','and','for','you','your','with','that','this','what','when','how','why','from','are','not','but','into','have','has','does','did','can','will','actually','about','than','then','they','their','our','its','was','were','use','using','get','out','all','any','more','most','one','two','new','just','still']);

const words = (p: Post) =>
  new Set(
    `${p.data.title} ${p.data.description}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );

// Top `n` related posts: same category weighs most, shared title/description terms break
// ties, recency breaks the rest. Deterministic so builds are stable.
export function relatedPosts(entry: Post, all: Post[], n = 3): Post[] {
  const mine = words(entry);
  return all
    .filter((p) => p.slug !== entry.slug)
    .map((p) => {
      let score = p.data.category === entry.data.category ? 3 : 0;
      for (const w of words(p)) if (mine.has(w)) score += 1;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || b.p.data.publishedDate.valueOf() - a.p.data.publishedDate.valueOf())
    .slice(0, n)
    .map((x) => x.p);
}

export type ServiceLink = { label: string; href: string; blurb: string };

const SERVICES: Record<string, ServiceLink> = {
  infra: { label: 'AI Infrastructure', href: '/services/ai-infrastructure.html', blurb: 'LLM gateway, evals, billing and observability.' },
  retrofit: { label: 'AI Automation Retrofit', href: '/services/ai-automation-retrofit.html', blurb: 'Add AI to your existing product or workflow.' },
  build: { label: 'AI Product Builds', href: '/services/ai-product-builds.html', blurb: 'From concept to a paying product.' },
  seo: { label: 'SEO & GEO Optimization', href: '/services/seo-geo-optimization.html', blurb: 'Get found by Google and by AI assistants.' },
  web: { label: 'Website Builds', href: '/services/website-builds.html', blurb: 'Custom sites with local SEO built in.' },
};

const BY_CATEGORY: Record<string, ServiceLink[]> = {
  'AI · Engineering': [SERVICES.infra, SERVICES.retrofit],
  'AI · Infrastructure': [SERVICES.infra, SERVICES.retrofit],
  Infrastructure: [SERVICES.infra],
  Automation: [SERVICES.retrofit, SERVICES.build],
  Process: [SERVICES.retrofit, SERVICES.build],
  Business: [SERVICES.build, SERVICES.web],
  Strategy: [SERVICES.build, SERVICES.retrofit],
  'SEO & GEO': [SERVICES.seo, SERVICES.web],
};

// Category sets the default; website/SEO wording in the title overrides it.
export function relatedServices(entry: Post): ServiceLink[] {
  const t = entry.data.title.toLowerCase();
  if (/\b(seo|geo)\b/.test(t)) return [SERVICES.seo, SERVICES.web];
  if (/\b(website|web design)\b/.test(t)) return [SERVICES.web, SERVICES.seo];
  return BY_CATEGORY[entry.data.category] ?? [SERVICES.build];
}
