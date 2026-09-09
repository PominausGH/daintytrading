import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { load } from 'cheerio';

const CASE_STUDY_SLUGS = new Set(['shuttersmith', 'edwards-kirby-lawyers', 'new-shutter-business']);

mkdirSync('src/content/projects', { recursive: true });

const files = readdirSync('projects').filter((f) => f.endsWith('.html'));
const report = [];

function yamlStr(s) {
  if (s == null) return '""';
  return JSON.stringify(String(s));
}

function yamlKey(k) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k);
}

function yamlBlock(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return '\n' + value.map((item) => pad + '  - ' + yamlInline(item, indent + 1)).join('\n');
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined);
    if (keys.length === 0) return '{}';
    return '\n' + keys.map((k) => {
      const v = value[k];
      if (v && typeof v === 'object') {
        return pad + '  ' + yamlKey(k) + ':' + yamlBlock(v, indent + 1);
      }
      return pad + '  ' + yamlKey(k) + ': ' + yamlScalar(v);
    }).join('\n');
  }
  return yamlScalar(value);
}

function yamlInline(item, indent) {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const keys = Object.keys(item).filter((k) => item[k] !== undefined);
    return keys.map((k, i) => {
      const v = item[k];
      const line = yamlKey(k) + ': ' + (v && typeof v === 'object' ? yamlBlock(v, indent + 1) : yamlScalar(v));
      return i === 0 ? line : '  '.repeat(indent) + '  ' + line;
    }).join('\n');
  }
  return yamlScalar(item);
}

function yamlScalar(v) {
  if (typeof v === 'string') return yamlStr(v);
  return JSON.stringify(v);
}

function frontmatter(obj) {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
  const lines = keys.map((k) => {
    const v = obj[k];
    if (v && typeof v === 'object') return k + ':' + yamlBlock(v, 0);
    return k + ': ' + yamlScalar(v);
  });
  return '---\n' + lines.join('\n') + '\n---\n';
}

for (const file of files) {
  const slug = file.replace(/\.html$/, '');
  const html = readFileSync(`projects/${file}`, 'utf8');
  const $ = load(html);
  const notes = [];

  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || title;
  const ogDescription = $('meta[property="og:description"]').attr('content') || description;
  const ogImage = $('meta[property="og:image"]').attr('content') || 'https://daintytrading.com/og-card.jpg';

  const name = $('.detail-hero h1').first().text().trim();
  const lede = $('.detail-hero .lede').first().text().trim();

  const metaChips = [];
  $('.meta-row .chip').each((_, el) => {
    const $el = $(el);
    const label = $el.find('strong').first().text().trim();
    const value = $el.clone().find('strong').remove().end().text().replace(/ /g, ' ').trim();
    if (label) metaChips.push({ label, value });
  });

  // screenshot block: div containing the 3 browser-chrome dot spans, with a picture/img inside
  let screenshot;
  const screenshotContainer = $('div:contains("brightpath.school"), picture').closest('div[style*="border-radius:14px"]');
  // more robust: find the outer wrapper div that has a child div with the 3 dot spans
  $('div').each((_, el) => {
    const $el = $(el);
    if (screenshot) return;
    const style = $el.attr('style') || '';
    if (style.includes('background:#0f1117') && $el.find('span[style*="background:#ff5f57"]').length) {
      const $wrapper = $el.parent();
      const $picture = $wrapper.find('picture, img').first();
      const $img = $wrapper.find('img').first();
      const $source = $wrapper.find('source').first();
      const $link = $wrapper.closest('a');
      if ($img.length) {
        screenshot = {
          image: $img.attr('src'),
          imageWebp: $source.attr('srcset') || undefined,
          alt: $img.attr('alt') || `${name} screenshot`,
          url: $link.length ? $link.attr('href') : undefined,
        };
      }
    }
  });

  const sidecardEl = $('aside.sidecard');
  const sidecard = {
    heading: sidecardEl.find('h4').first().text().trim() || 'Project facts',
    rows: [],
  };
  sidecardEl.find('.label-row').each((_, el) => {
    const spans = $(el).find('span');
    const label = $(spans.get(0)).text().trim();
    const value = $(spans.get(1)).text().trim();
    sidecard.rows.push({ label, value });
  });
  const primaryBtn = sidecardEl.find('a.btn-primary').first();
  if (primaryBtn.length) sidecard.primaryCta = { label: primaryBtn.text().trim(), href: primaryBtn.attr('href') };
  const ghostBtn = sidecardEl.find('a.btn-ghost').first();
  if (ghostBtn.length) sidecard.ghostCta = { label: ghostBtn.text().trim(), href: ghostBtn.attr('href') };

  const ctaBanner = $('.cta-banner').first();
  const ctaBannerHeading = ctaBanner.find('h2').first().text().trim();
  const ctaBannerBody = ctaBanner.find('p').first().text().trim();

  let prevLink, nextLink;
  const nextPrev = $('.next-prev');
  const navLinks = nextPrev.find('a');
  navLinks.each((_, el) => {
    const $el = $(el);
    const lbl = $el.find('.lbl').text().trim();
    const ttl = $el.find('.ttl').text().trim();
    const href = $el.attr('href');
    if (/previous/i.test(lbl)) prevLink = { label: ttl, href };
    else if (/next/i.test(lbl)) nextLink = { label: ttl, href };
  });

  // JSON-LD: find the non-BreadcrumbList block
  let schemaType, schemaExtra, client;
  $('script[type="application/ld+json"]').each((_, el) => {
    let json;
    try { json = JSON.parse($(el).contents().text()); } catch { return; }
    if (json['@type'] === 'BreadcrumbList') return;
    schemaType = json['@type'];
    const extra = { ...json };
    delete extra['@context'];
    delete extra['@type'];
    delete extra['name'];
    delete extra['description'];
    delete extra['url'];
    if (Object.keys(extra).length) schemaExtra = extra;
  });

  const isCaseStudy = CASE_STUDY_SLUGS.has(slug);
  if (isCaseStudy) client = name;
  if (!schemaType) { schemaType = isCaseStudy ? 'CreativeWork' : 'SoftwareApplication'; notes.push('no JSON-LD found, defaulted schemaType'); }

  const bodyHtml = $('.detail-body article.prose').html()?.trim() || '';
  if (!bodyHtml) notes.push('EMPTY BODY — article.prose not found');
  if (!screenshot && !isCaseStudy) notes.push('no screenshot block (expected for some products)');
  if (sidecard.rows.length === 0) notes.push('no sidecard rows found');

  const frontmatterObj = {
    type: isCaseStudy ? 'case-study' : 'product',
    name,
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage,
    lede,
    metaChips,
    screenshot,
    sidecard,
    ctaBannerHeading,
    ctaBannerBody,
    prevLink,
    nextLink,
    schemaType,
    schemaExtra,
    ...(isCaseStudy ? { client } : {}),
  };

  const out = frontmatter(frontmatterObj) + '\n' + bodyHtml + '\n';
  writeFileSync(`src/content/projects/${slug}.md`, out);
  report.push({ slug, type: frontmatterObj.type, notes });
}

console.log(`Migrated ${files.length} files.`);
console.log(JSON.stringify(report.filter((r) => r.notes.length), null, 2));
